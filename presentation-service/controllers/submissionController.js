const Presentation = require('../models/Presentation');
const PresentationSubmission = require('../models/PresentationSubmission');
const s3Client = require('../config/s3');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Student uploads submission
exports.uploadSubmission = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (req.user.role !== 'student') {
                return res.status(403).json({ error: 'Only students can upload' });
            }

            const { presentationId } = req.body;
            const presentation = await Presentation.findById(presentationId);
            if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

            // Check if student is assigned
            // Note: Mongoose's .includes() handles ObjectId comparison correctly.
            if (!presentation.assignedStudents.includes(req.user.id)) {
                return res.status(403).json({ error: 'Not assigned to you' });
            }

            let fileData = {};
            if (req.file) {
                const fileKey = `submissions/${req.user.id}-${Date.now()}-${req.file.originalname}`;
                await new Upload({
                    client: s3Client,
                    params: {
                        Bucket: process.env.S3_BUCKET_NAME,
                        Key: fileKey,
                        Body: req.file.buffer,
                        ContentType: req.file.mimetype,
                    },
                }).done();

                fileData = {
                    fileId: fileKey,
                    fileType: req.file.mimetype,
                    size: req.file.size,
                    originalName: req.file.originalname,
                };
            }

            let submission = await PresentationSubmission.findOne({ presentationId, studentId: req.user.id });

            if (submission) {
                if (submission.gradedAt) {
                    return res.status(400).json({ error: 'Already graded, cannot modify' });
                }
                // delete old file
                if (submission.fileId) {
                    try {
                        await s3Client.send(new DeleteObjectCommand({
                            Bucket: process.env.S3_BUCKET_NAME,
                            Key: submission.fileId,
                        }));
                    } catch (err) {
                        console.warn('Failed to delete old file from S3:', err);
                    }
                }
                submission.fileId = fileData.fileId;
                submission.fileType = fileData.fileType;
                submission.size = fileData.size;
                submission.originalName = fileData.originalName;
                submission.uploadedAt = Date.now();
            } else {
                submission = new PresentationSubmission({
                    presentationId,
                    studentId: req.user.id,
                    ...fileData,
                });
            }

            await submission.save();
            res.status(201).json(submission);
        } catch (err) {
            console.error('Upload error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
];

// Teacher/student view submissions
exports.getSubmissions = async (req, res) => {
    try {
        const { presentationId } = req.params;
        const presentation = await Presentation.findById(presentationId);
        if (!presentation) return res.status(404).json({ error: 'Not found' });

        const submissions = await PresentationSubmission.find({ presentationId });

        res.json(submissions);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Teacher grades a submission
exports.gradeSubmission = async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ error: 'Only teachers can grade' });
        }

        const { id } = req.params;
        const { marks, feedback } = req.body;

        const submission = await PresentationSubmission.findById(id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });

        submission.marks = marks;
        submission.feedback = feedback;
        submission.gradedAt = Date.now();
        submission.gradedBy = req.user.id;
        submission.status = 'graded';

        await submission.save();
        res.json(submission);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get signed URL to download a submission file
exports.getSubmissionFileSignedUrl = async (req, res) => {
    try {
        const { id } = req.params; // submission ID
        const submission = await PresentationSubmission.findById(id);
        if (!submission || !submission.fileId) return res.status(404).json({ error: 'File not found' });

        const presentation = await Presentation.findById(submission.presentationId);
        if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

        // NOTE: The previous restrictive check that only allowed assigned students to download
        // has been removed here to allow all authenticated students (in the class) to access 
        // the file via the front-end's optional view functionality.
        
        // This implicitly allows:
        // - Teachers (req.user.role != 'student')
        // - Any student authenticated in the system.
        
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: submission.fileId,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url, fileName: submission.originalName });
    } catch (err) {
        console.error('Error getting submission file URL:', err);
        res.status(500).json({ error: 'Server error' });
    }
};