const Assignment = require("../models/Assignment");
const s3Client = require("../config/s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Upload assignment
exports.uploadAssignment = async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ msg: "Only teachers can upload assignments" });

  try {
    const { classId, title, description, dueDate } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ msg: "No file provided" });

    const key = `${Date.now()}-${file.originalname}`;
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });
    await upload.done();

    const assignment = new Assignment({
      classId,
      uploader: req.user.id,
      title,
      description,
      fileId: key,
      fileType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
      dueDate: dueDate ? new Date(dueDate) : null,
    });

    await assignment.save();
    res.status(201).json({ assignment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Upload failed", error: err.message });
  }
};

// Update assignment
exports.updateAssignment = async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ msg: "Only teachers can update assignments" });

  try {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;
    const file = req.file; // New file from multer

    const assignment = await Assignment.findById(id);
    if (!assignment) return res.status(404).json({ msg: "Assignment not found" });
    if (assignment.uploader.toString() !== req.user.id)
      return res.status(403).json({ msg: "Cannot update others' assignments" });

    // --- 1. Handle File Replacement (If new file is provided) ---
    if (file) {
        const oldFileKey = assignment.fileId; // Save key for deletion
        const newKey = `${Date.now()}-${file.originalname}`;

        // a. Upload New File to S3
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: newKey,
                Body: file.buffer,
                ContentType: file.mimetype,
            },
        });
        await upload.done();

        // b. Delete Old File from S3 (if one existed)
        if (oldFileKey) {
            try {
                await s3Client.send(
                    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: oldFileKey })
                );
            } catch (s3Err) {
                // Log but continue, new file is uploaded and DB must be updated
                console.warn("Could not delete old assignment S3 file:", s3Err.message);
            }
        }

        // c. Update DB record with new file details
        assignment.fileId = newKey;
        assignment.fileType = file.mimetype;
        assignment.size = file.size;
        assignment.originalName = file.originalname;
    }
    
    // --- 2. Update Text Fields ---
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = new Date(dueDate);
    assignment.lastUpdated = new Date();

    await assignment.save();
    res.json({ msg: "Assignment updated", assignment });
  } catch (err) {
    console.error("Update Assignment Failed:", err);
    res.status(500).json({ msg: "Update failed", error: err.message });
  }
};

// Get assignments by class
exports.getAssignmentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const assignments = await Assignment.find({ classId }).sort({ uploadedAt: -1 });
    res.json({ assignments });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch assignments", error: err.message });
  }
};

// Get signed URL
exports.getSignedUrl = async (req, res) => {
  const { id } = req.params;
  const { action } = req.query;

  try {
    const assignment = await Assignment.findById(id);
    if (!assignment) return res.status(404).json({ msg: "Assignment not found" });

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: assignment.fileId,
      ResponseContentDisposition:
        action === "download"
          ? `attachment; filename="${assignment.originalName.replace(/"/g, "")}"`
          : `inline; filename="${assignment.originalName.replace(/"/g, "")}"`,
      ResponseContentType: assignment.fileType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.json({ url: signedUrl });
  } catch (err) {
    res.status(500).json({ msg: "Failed to get signed URL", error: err.message });
  }
};

// Delete assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ msg: "Assignment not found" });
    if (assignment.uploader.toString() !== req.user.id)
      return res.status(403).json({ msg: "Cannot delete others' assignments" });

    await s3Client.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: assignment.fileId })
    );

    await assignment.deleteOne();
    res.json({ msg: "Assignment deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Delete failed", error: err.message });
  }
};