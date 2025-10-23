const Presentation = require('../models/Presentation');
const PresentationSubmission = require('../models/PresentationSubmission');
const s3Client = require('../config/s3');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Create presentation
exports.createPresentation = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (req.user.role !== 'teacher') {
                return res.status(403).json({ error: 'Only teachers can create presentations' });
            }

            const { classId, title, description, assignedStudents } = req.body;

            // CORRECTED: Safely parse the assignedStudents JSON string
            let parsedAssignedStudents = [];
            if (assignedStudents) {
                try {
                    parsedAssignedStudents = JSON.parse(assignedStudents);
                } catch (e) {
                    console.error('Failed to parse assignedStudents:', e);
                    return res.status(400).json({ error: 'Invalid assignedStudents format' });
                }
            }

            let fileData = {};
            if (req.file) {
                const fileKey = `presentations/${Date.now()}-${req.file.originalname}`;
                const uploadParams = {
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: fileKey,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                };
                await new Upload({ client: s3Client, params: uploadParams }).done();

                fileData = {
                    fileId: fileKey,
                    fileType: req.file.mimetype,
                    size: req.file.size,
                    originalName: req.file.originalname,
                };
            }

            const presentation = new Presentation({
                classId,
                uploader: req.user.id,
                title,
                description,
                assignedStudents: parsedAssignedStudents, // Use the parsed array
                ...fileData,
            });

            await presentation.save();
            res.status(201).json(presentation);
        } catch (err) {
            console.error('Error creating presentation:', err);
            res.status(500).json({ error: 'Server error' });
        }
    },
];

// Get presentations by class
exports.getPresentationsByClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const presentations = await Presentation.find({ classId }).sort({ uploadedAt: -1 });
        res.json(presentations);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get signed URL for presentation file (teacher or student)
exports.getPresentationFileSignedUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const presentation = await Presentation.findById(id);
        if (!presentation || !presentation.fileId) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Students and teachers can download the file
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: presentation.fileId,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url, fileName: presentation.originalName });
    } catch (err) {
        console.error('Error generating signed URL:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete presentation (cascade submissions)
exports.deletePresentation = async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ error: 'Only teachers can delete presentations' });
        }

        const { id } = req.params;
        const presentation = await Presentation.findById(id);
        if (!presentation) return res.status(404).json({ error: 'Not found' });

        // delete teacher file
        if (presentation.fileId) {
            try {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: presentation.fileId,
                }));
            } catch (err) {
                console.warn('Failed to delete teacher file from S3:', err);
            }
        }

        // delete submissions + files
        const submissions = await PresentationSubmission.find({ presentationId: id });
        for (let sub of submissions) {
            if (sub.fileId) {
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: process.env.S3_BUCKET_NAME,
                        Key: sub.fileId,
                    }));
                } catch (err) {
                    console.warn('Failed to delete student file from S3:', err);
                }
            }
        }
        await PresentationSubmission.deleteMany({ presentationId: id });

        await Presentation.findByIdAndDelete(id);

        res.json({ message: 'Presentation and related submissions deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Update presentation
exports.updatePresentation = [
    upload.single('file'), // Use multer to handle file upload (if present)
    async (req, res) => {
        try {
            if (req.user.role !== 'teacher') {
                return res.status(403).json({ error: 'Only teachers can update presentations' });
            }

            const { id } = req.params;
            const { title, description, assignedStudents } = req.body;

            const presentation = await Presentation.findById(id);
            if (!presentation) {
                return res.status(404).json({ error: 'Presentation not found' });
            }

            // Optional: Add an authorization check if the presentation uploader needs to match the current user.
            // if (presentation.uploader.toString() !== req.user.id) {
            //     return res.status(403).json({ error: 'Not authorized to edit this presentation' });
            // }

            // 1. Safely parse the assignedStudents JSON string
            let parsedAssignedStudents = presentation.assignedStudents; // Default to existing
            if (assignedStudents) {
                try {
                    parsedAssignedStudents = JSON.parse(assignedStudents);
                } catch (e) {
                    console.error('Failed to parse assignedStudents:', e);
                    return res.status(400).json({ error: 'Invalid assignedStudents format' });
                }
            }
            
            // 2. Handle File Update (if a new file is uploaded)
            let fileData = {};
            if (req.file) {
                // Delete old file from S3 if it exists
                if (presentation.fileId) {
                    try {
                        await s3Client.send(new DeleteObjectCommand({
                            Bucket: process.env.S3_BUCKET_NAME,
                            Key: presentation.fileId,
                        }));
                    } catch (err) {
                        console.warn('Failed to delete old teacher file from S3 during update:', err);
                    }
                }

                // Upload new file to S3
                const fileKey = `presentations/${Date.now()}-${req.file.originalname}`;
                const uploadParams = {
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: fileKey,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                };
                await new Upload({ client: s3Client, params: uploadParams }).done();

                fileData = {
                    fileId: fileKey,
                    fileType: req.file.mimetype,
                    size: req.file.size,
                    originalName: req.file.originalname,
                };
            }
            
            // 3. Update Mongoose document
            presentation.title = title || presentation.title;
            presentation.description = description || presentation.description;
            presentation.assignedStudents = parsedAssignedStudents;
            presentation.lastUpdated = Date.now();
            
            // Apply new file data if a file was uploaded
            if (req.file) {
                presentation.fileId = fileData.fileId;
                presentation.fileType = fileData.fileType;
                presentation.size = fileData.size;
                presentation.originalName = fileData.originalName;
            }

            await presentation.save();
            res.json(presentation);
        } catch (err) {
            console.error('Error updating presentation:', err);
            res.status(500).json({ error: 'Server error' });
        }
    },
];