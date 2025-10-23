const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const axios = require("axios");
const s3Client = require("../config/s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Set the base URL for user-service
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:5000";

// Helper: fetch student info from user-service
async function getStudentInfo(studentId) {
  try {
    const res = await axios.get(`${USER_SERVICE_URL}/api/users/${studentId}/internal`);
    return { name: res.data.name, email: res.data.email, _id: res.data._id };
  } catch (err) {
    console.error("Failed to fetch student info:", err.message);
    return { name: "Unknown", email: "", _id: studentId };
  }
}

// Student uploads/replaces submission

exports.uploadSubmission = async (req, res) => {
    if (req.user.role !== "student")
        return res.status(403).json({ msg: "Only students can submit assignments" });

    try {
        const { assignmentId } = req.body;
        const file = req.file;
        if (!file) return res.status(400).json({ msg: "No file provided" });

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ msg: "Assignment not found" });
        if (new Date() > assignment.dueDate)
            return res.status(403).json({ msg: "Submission closed: past due date" });

        const studentId = req.user.id || req.user._id;
        if (!studentId) return res.status(400).json({ msg: "Student ID missing" });

        // --- 1. Upload NEW submission to S3 ---
        const newKey = `${Date.now()}-${file.originalname}`;
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: newKey,
                Body: file.buffer,
                ContentType: file.mimetype,
            },
        });
        await upload.done(); // Wait for new file upload

        // --- 2. Check for EXISTING submission and DELETE OLD S3 file ---
        let submission = await Submission.findOne({ assignmentId, studentId });
        let isUpdate = !!submission; // Flag if we found an existing submission

        if (isUpdate) {
            // Found existing submission, delete OLD S3 file
            try {
                await s3Client.send(
                    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: submission.fileId })
                );
            } catch (s3Err) {
                // Log but continue, as the new file is uploaded and we need to update the DB
                console.warn("Could not delete old S3 file:", s3Err.message);
            }

            // --- 3. Update existing DB record with new file details ---
            submission.fileId = newKey; // Update to the NEW S3 key
            submission.fileType = file.mimetype;
            submission.size = file.size;
            submission.originalName = file.originalname;
            submission.uploadedAt = new Date(); // Reset submission time
            
            await submission.save();
        } else {
            // --- 4. Create NEW DB record ---
            submission = new Submission({
                assignmentId,
                studentId,
                fileId: newKey,
                fileType: file.mimetype,
                size: file.size,
                originalName: file.originalname,
            });
            await submission.save();
        }

        res.status(isUpdate ? 200 : 201).json({ submission });
    } catch (err) {
        console.error("Upload failed:", err);
        res.status(500).json({ msg: "Upload failed", error: err.message });
    }
};

// Get submissions (teacher: all / student: own)
exports.getSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    if (!assignmentId) return res.status(400).json({ msg: "Assignment ID is required" });

    let submissions;
    const studentId = req.user.id || req.user._id;

    if (req.user.role === "teacher") {
      submissions = await Submission.find({ assignmentId }).sort({ uploadedAt: -1 });
      const submissionsWithStudentInfo = await Promise.all(
        submissions.map(async (s) => {
          const student = await getStudentInfo(s.studentId);
          return {
            _id: s._id,
            assignmentId: s.assignmentId,
            studentId: student,
            originalName: s.originalName,
            fileType: s.fileType,
            size: s.size,
            marks: s.marks ?? null,
            feedback: s.feedback ?? "",
            uploadedAt: s.uploadedAt,
            gradedAt: s.gradedAt ?? null,
            gradedBy: s.gradedBy ?? null,
          };
        })
      );
      return res.json({ submissions: submissionsWithStudentInfo });
    } else {
      submissions = await Submission.find({ assignmentId, studentId }).sort({ uploadedAt: -1 });
      return res.json({ submissions });
    }
  } catch (err) {
    console.error("Failed to fetch submissions:", err);
    return res.status(500).json({ msg: "Failed to fetch submissions", error: err.message });
  }
};

// Teacher grades submission
exports.gradeSubmission = async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ msg: "Only teachers can grade submissions" });

  try {
    const { id } = req.params;
    const { marks, feedback } = req.body;

    const submission = await Submission.findById(id);
    if (!submission) return res.status(404).json({ msg: "Submission not found" });

    submission.marks = marks;
    submission.feedback = feedback;
    submission.gradedAt = new Date();
    submission.gradedBy = req.user.id;

    await submission.save();
    res.json({ msg: "Graded successfully", submission });
  } catch (err) {
    res.status(500).json({ msg: "Grading failed", error: err.message });
  }
};

// Get signed URL for submission file
exports.getSignedUrl = async (req, res) => {
  const { id } = req.params;
  const { action } = req.query;

  try {
    const sub = await Submission.findById(id);
    if (!sub) return res.status(404).json({ msg: "Submission not found" });
    if (req.user.role === "student" && sub.studentId.toString() !== req.user.id)
      return res.status(403).json({ msg: "Cannot view others' submissions" });

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: sub.fileId,
      ResponseContentDisposition:
        action === "download"
          ? `attachment; filename="${sub.fileId.replace(/"/g, "")}"`
          : `inline; filename="${sub.fileId.replace(/"/g, "")}"`,
      ResponseContentType: sub.fileType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.json({ url: signedUrl });
  } catch (err) {
    res.status(500).json({ msg: "Failed to get signed URL", error: err.message });
  }
};

// Delete submission (student only, before due date)
exports.deleteSubmission = async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ msg: "Submission not found" });
    if (sub.studentId.toString() !== req.user.id)
      return res.status(403).json({ msg: "Cannot delete others' submissions" });

    const assignment = await Assignment.findById(sub.assignmentId);
    if (new Date() > assignment.dueDate)
      return res.status(403).json({ msg: "Cannot delete after due date" });

    await s3Client.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: sub.fileId })
    );
    await sub.deleteOne();
    res.json({ msg: "Submission deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Delete failed", error: err.message });
  }
};

