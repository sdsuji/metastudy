const Test = require("../models/Test");
const s3Client = require("../config/s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Helper function to delete S3 object
const deleteS3Object = async (key) => {
    if (!key) return;
    const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
    });
    await s3Client.send(command);
};

exports.createTest = async (req, res) => {
    if (req.user.role !== "teacher") return res.status(403).json({ msg: "Only teachers can create tests" });

    try {
        const { classId, title, description, dueDate, gradingMethod } = req.body;
        const files = req.files;
        
        const questionFile = files.questionFile ? files.questionFile[0] : null;
        const solutionFile = files.solutionFile ? files.solutionFile[0] : null;

        if (!questionFile) return res.status(400).json({ msg: "Test Question File is required" });
        if (gradingMethod === 'auto' && !solutionFile) {
            return res.status(400).json({ msg: "Auto-Grading requires a Solution File." });
        }
        
        // 1. Upload Question File
        const qKey = `tests/${Date.now()}-Q-${questionFile.originalname}`;
        await new Upload({ client: s3Client, params: { Bucket: process.env.S3_BUCKET_NAME, Key: qKey, Body: questionFile.buffer } }).done();

        // 2. Upload Solution File (Conditional)
        let sKey = null;
        if (solutionFile) {
            sKey = `tests/${Date.now()}-S-${solutionFile.originalname}`;
            await new Upload({ client: s3Client, params: { Bucket: process.env.S3_BUCKET_NAME, Key: sKey, Body: solutionFile.buffer } }).done();
        }

        // 3. Save Test to DB
        const test = new Test({
            classId, uploader: req.user.id, title, description, dueDate: new Date(dueDate), gradingMethod,
            questionFileId: qKey, fileType: questionFile.mimetype, originalName: questionFile.originalname, solutionFileId: sKey,
        });

        await test.save();
        res.status(201).json({ test });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Test creation failed", error: err.message });
    }
};

exports.getTestsByClass = async (req, res) => {
    try {
        const tests = await Test.find({ classId: req.params.classId }).sort({ uploadedAt: -1 });
        res.json({ tests });
    } catch (err) {
        res.status(500).json({ msg: "Failed to fetch tests", error: err.message });
    }
};

exports.getSignedUrl = async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ msg: "Test not found" });

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME, Key: test.questionFileId, 
            ResponseContentDisposition: req.query.action === "download" ? `attachment; filename="${test.originalName}"` : `inline; filename="${test.originalName}"`,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url: signedUrl });
    } catch (err) {
        res.status(500).json({ msg: "Failed to get signed URL", error: err.message });
    }
};

/**
 * UPDATED: Handles updating metadata AND optionally replacing the question file.
 * NOTE: The router must be updated to include multer middleware for this to work.
 */
exports.updateTest = async (req, res) => {
    if (req.user.role !== "teacher") return res.status(403).json({ msg: "Only teachers can update tests" });
    
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ msg: "Test not found" });
        if (test.uploader.toString() !== req.user.id) return res.status(403).json({ msg: "Unauthorized" });

        const newQuestionFile = req.files && req.files.questionFile ? req.files.questionFile[0] : null;
        
        // 1. Update text fields (title, description, dueDate)
        Object.assign(test, req.body); 

        // 2. Handle new Question File upload
        if (newQuestionFile) {
            // A. Delete the old file from S3
            await deleteS3Object(test.questionFileId);

            // B. Upload the new file
            const newQKey = `tests/${Date.now()}-Q-${newQuestionFile.originalname}`;
            await new Upload({ 
                client: s3Client, 
                params: { 
                    Bucket: process.env.S3_BUCKET_NAME, 
                    Key: newQKey, 
                    Body: newQuestionFile.buffer 
                } 
            }).done();

            // C. Update the DB record with new file details
            test.questionFileId = newQKey;
            test.fileType = newQuestionFile.mimetype;
            test.originalName = newQuestionFile.originalname;
        }

        await test.save();
        res.json({ msg: "Test updated", test });
    } catch (err) {
        console.error("Update failed:", err);
        res.status(500).json({ msg: "Update failed", error: err.message });
    }
};

exports.deleteTest = async (req, res) => {
    if (req.user.role !== "teacher") return res.status(403).json({ msg: "Only teachers can delete tests" });

    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ msg: "Test not found" });
        if (test.uploader.toString() !== req.user.id) return res.status(403).json({ msg: "Unauthorized" });

        // A. Delete files from S3
        await deleteS3Object(test.questionFileId);
        if (test.solutionFileId) {
            await deleteS3Object(test.solutionFileId);
        }
        
        // NOTE: In a complete system, you would also delete all related Submissions here.

        // B. Delete the Test record
        await test.deleteOne();
        res.json({ msg: "Test deleted successfully" });
    } catch (err) {
        console.error("Delete failed:", err);
        res.status(500).json({ msg: "Delete failed", error: err.message });
    }
};