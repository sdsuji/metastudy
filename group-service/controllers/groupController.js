const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const s3Client = require('../config/s3');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Create group
exports.createGroup = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (req.user.role !== 'teacher') {
                return res.status(403).json({ error: 'Only teachers can create groups' });
            }

            const { classId, title, description, assignedStudents } = req.body;

            // Safely parse the assignedStudents JSON string
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
                const fileKey = `groups/${Date.now()}-${req.file.originalname}`;
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

            const group = new Group({
                classId,
                uploader: req.user.id,
                title,
                description,
                assignedStudents: parsedAssignedStudents,
                ...fileData,
            });

            await group.save();
            
            // 🌟 CRITICAL FIX: Initialize GroupMember records for all assigned students
            const memberRecords = parsedAssignedStudents.map(studentId => ({
                groupId: group._id,
                studentId: studentId,
                status: 'assigned', // Default status for membership
            }));

            if (memberRecords.length > 0) {
                await GroupMember.insertMany(memberRecords); 
            }
            // -----------------------------------------------------------------

            res.status(201).json(group);
        } catch (err) {
            console.error('Error creating group:', err);
            res.status(500).json({ error: 'Server error' });
        }
    },
];

// Get groups by class (No change needed)
exports.getGroupsByClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const groups = await Group.find({ classId }).sort({ uploadedAt: -1 });
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get signed URL for group file (No change needed)
exports.getGroupFileSignedUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await Group.findById(id);
        if (!group || !group.fileId) {
            return res.status(404).json({ error: 'File not found' });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: group.fileId,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url, fileName: group.originalName });
    } catch (err) {
        console.error('Error generating signed URL:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete group (cascade members - No change needed)
exports.deleteGroup = async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ error: 'Only teachers can delete groups' });
        }

        const { id } = req.params;
        const group = await Group.findById(id);
        if (!group) return res.status(404).json({ error: 'Not found' });

        // delete teacher file
        if (group.fileId) {
            try {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: group.fileId,
                }));
            } catch (err) {
                console.warn('Failed to delete teacher file from S3:', err);
            }
        }

        // delete members + files
        const members = await GroupMember.find({ groupId: id });
        for (let member of members) {
            if (member.fileId) {
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: process.env.S3_BUCKET_NAME,
                        Key: member.fileId,
                    }));
                } catch (err) {
                    console.warn('Failed to delete student file from S3:', err);
                }
            }
        }
        await GroupMember.deleteMany({ groupId: id });

        await Group.findByIdAndDelete(id);

        res.json({ message: 'Group and related members deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Update group
exports.updateGroup = [
    upload.single('file'), // Use multer to handle file upload (if present)
    async (req, res) => {
        try {
            if (req.user.role !== 'teacher') {
                return res.status(403).json({ error: 'Only teachers can update groups' });
            }

            const { id } = req.params;
            const { title, description, assignedStudents } = req.body;

            const group = await Group.findById(id);
            if (!group) {
                return res.status(404).json({ error: 'Group not found' });
            }

            // Store current and new student lists as strings for easy comparison
            const existingAssignedStudents = group.assignedStudents.map(id => id.toString());
            let parsedAssignedStudents = existingAssignedStudents;

            // 1. Safely parse the assignedStudents JSON string
            if (assignedStudents) {
                try {
                    parsedAssignedStudents = JSON.parse(assignedStudents);
                } catch (e) {
                    console.error('Failed to parse assignedStudents:', e);
                    return res.status(400).json({ error: 'Invalid assignedStudents format' });
                }
            }
            const newAssignedStudents = parsedAssignedStudents.map(id => id.toString());

            // 2. Handle File Update (if a new file is uploaded)
            let fileData = {};
            if (req.file) {
                // Delete old file from S3 if it exists
                if (group.fileId) {
                    try {
                        await s3Client.send(new DeleteObjectCommand({
                            Bucket: process.env.S3_BUCKET_NAME,
                            Key: group.fileId,
                        }));
                    } catch (err) {
                        console.warn('Failed to delete old teacher file from S3 during update:', err);
                    }
                }

                // Upload new file to S3
                const fileKey = `groups/${Date.now()}-${req.file.originalname}`;
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
            group.title = title || group.title;
            group.description = description || group.description;
            group.assignedStudents = parsedAssignedStudents;
            group.lastUpdated = Date.now();

            // Apply new file data if a file was uploaded
            if (req.file) {
                group.fileId = fileData.fileId;
                group.fileType = fileData.fileType;
                group.size = fileData.size;
                group.originalName = fileData.originalName;
            }

            await group.save();
            
            // 🌟 CRITICAL FIX: Synchronize GroupMember records when assignment changes
            
            // A. Students to REMOVE: 
            const studentsToRemove = existingAssignedStudents.filter(studentId => 
                !newAssignedStudents.includes(studentId)
            );
            
            if (studentsToRemove.length > 0) {
                // Only delete members who have NOT been graded
                await GroupMember.deleteMany({ 
                    groupId: group._id, 
                    studentId: { $in: studentsToRemove },
                    status: { $ne: 'graded' } 
                });
            }

            // B. Students to ADD:
            const studentsToAdd = newAssignedStudents.filter(studentId => 
                !existingAssignedStudents.includes(studentId)
            );
            
            if (studentsToAdd.length > 0) {
                const memberRecords = studentsToAdd.map(studentId => ({
                    groupId: group._id,
                    studentId: studentId,
                    status: 'assigned',
                }));
                // Insert new records
                await GroupMember.insertMany(memberRecords, { ordered: false })
                    .catch(e => console.warn('Attempted to add existing GroupMember records:', e.message));
            }
            // ----------------------------------------------------------------------

            res.json(group);
        } catch (err) {
            console.error('Error updating group:', err);
            res.status(500).json({ error: 'Server error' });
        }
    },
];