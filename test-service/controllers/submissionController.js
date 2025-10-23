const TestSubmission = require("../models/TestSubmission");
const Test = require("../models/Test");
const s3Client = require("../config/s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { runAutoGrade } = require("../services/autoGraderService");
const axios = require("axios");
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;

// Helper: fetch student info (assuming your user service is running)
async function getStudentInfo(studentId) {
    try {
        const res = await axios.get(`${USER_SERVICE_URL}/api/users/${studentId}/internal`);
        return res.data;
    } catch (err) {
        return { name: "Unknown User", email: "N/A", _id: studentId };
    }
}

exports.uploadSubmission = async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Only students can submit tests" });
    try {
        const { testId } = req.body;
        const file = req.file;
        const studentId = req.user.id;

        const test = await Test.findById(testId);
        if (!test) return res.status(404).json({ msg: "Test not found" });
        
        // **NEW CHECK: Prevent submission if already graded**
        const existingSubmission = await TestSubmission.findOne({ testId, studentId });
        if (existingSubmission && existingSubmission.gradedAt) {
             return res.status(403).json({ msg: "Submission failed: Test has already been graded." });
        }
        
        // Existing check for due date
        if (new Date() > test.dueDate) return res.status(403).json({ msg: "Submission closed: past due date" });

        // 1. Handle S3 Upload/Replacement
        const newKey = `submissions/${Date.now()}-SUB-${file.originalname}`;
        await new Upload({ client: s3Client, params: { Bucket: process.env.S3_BUCKET_NAME, Key: newKey, Body: file.buffer } }).done();

        // 2. Find/Update DB Record
        let submission = existingSubmission;
        if (submission) {
            // Delete old file from S3 (optional, for cleanup)
            try { await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: submission.fileId })); } catch (e) { console.warn("Old S3 file delete failed"); }
            // Update fields (resubmission resets grade/status)
            submission.fileId = newKey; submission.fileType = file.mimetype; submission.originalName = file.originalname; submission.uploadedAt = new Date();
            submission.marks = null; submission.feedback = ""; submission.gradedAt = null; submission.gradedBy = null; submission.autoGradeStatus = 'pending';
            await submission.save();
        } else {
            submission = await TestSubmission.create({ testId, studentId, fileId: newKey, fileType: file.mimetype, originalName: file.originalname });
        }

        // 3. Trigger Auto-Grading (Non-blocking)
        if (test.gradingMethod === 'auto') {
            runAutoGrade(submission).catch(error => console.error(`Background Auto-Grading failed: ${error.message}`));
            return res.status(200).json({ submission, msg: "Test submitted. Auto-grading initiated." });
        }
        
        res.status(200).json({ submission });
    } catch (err) {
        console.error("Upload failed:", err);
        res.status(500).json({ msg: `Upload failed: ${err.message}` });
    }
};

// --- NEW FUNCTION: Get the single latest student submission for status check ---
exports.getLatestStudentSubmission = async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ msg: "Unauthorized" });
    try {
        const studentId = req.user.id;
        const { testId } = req.params;

        const latestSubmission = await TestSubmission.findOne({
            testId: testId,
            studentId: studentId
        })
        .sort({ uploadedAt: -1 }) // Sort by latest uploaded time (descending)
        .select('_id gradedAt marks feedback autoGradeStatus uploadedAt') // Only return necessary fields
        .lean(); 

        if (!latestSubmission) {
            return res.status(200).json({ submission: null, msg: 'No submission found.' });
        }

        res.status(200).json({ submission: latestSubmission });

    } catch (err) {
        console.error('Error fetching latest student submission:', err.message);
        res.status(500).json({ msg: 'Server error while fetching submission status.' });
    }
};

exports.getSubmissions = async (req, res) => {
    try {
        let submissions;
        if (req.user.role === "teacher") {
            submissions = await TestSubmission.find({ testId: req.params.testId }).sort({ uploadedAt: -1 });
            const populatedSubs = await Promise.all(
                submissions.map(async (s) => ({ ...s.toObject(), studentId: await getStudentInfo(s.studentId) }))
            );
            return res.json({ submissions: populatedSubs });
        } else {
            // For students, this fetches ALL their submissions for the test
            submissions = await TestSubmission.find({ testId: req.params.testId, studentId: req.user.id }).sort({ uploadedAt: -1 });
            return res.json({ submissions });
        }
    } catch (err) {
        res.status(500).json({ msg: "Failed to fetch submissions", error: err.message });
    }
};

exports.gradeSubmission = async (req, res) => {
    if (req.user.role !== "teacher") return res.status(403).json({ msg: "Only teachers can grade submissions" });
    try {
        const { marks, feedback } = req.body;
        const submission = await TestSubmission.findById(req.params.id);
        if (!submission) return res.status(404).json({ msg: "Submission not found" });

        submission.marks = marks;
        submission.feedback = feedback;
        submission.gradedAt = new Date();
        submission.gradedBy = req.user.id;
        submission.autoGradeStatus = 'scored'; // Mark as manually finalized

        await submission.save();
        res.json({ msg: "Graded successfully", submission });
    } catch (err) {
        res.status(500).json({ msg: "Grading failed", error: err.message });
    }
};

exports.getSignedUrl = async (req, res) => {
    try {
        const sub = await TestSubmission.findById(req.params.id);
        if (!sub) return res.status(404).json({ msg: "Submission not found" });
        if (req.user.role === "student" && sub.studentId.toString() !== req.user.id) return res.status(403).json({ msg: "Unauthorized" });

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME, Key: sub.fileId, 
            ResponseContentDisposition: req.query.action === "download" ? `attachment; filename="${sub.originalName}"` : `inline; filename="${sub.originalName}"`,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url: signedUrl });
    } catch (err) {
        res.status(500).json({ msg: "Failed to get signed URL", error: err.message });
    }
};