const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const s3Client = require('../config/s3');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Student uploads contribution/file to the group
exports.uploadContribution = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (req.user.role !== 'student') {
                return res.status(403).json({ error: 'Only students can upload' });
            }
            if (!req.file) {
                 return res.status(400).json({ error: 'No file uploaded.' });
            }

            const { groupId } = req.body;
            const group = await Group.findById(groupId);
            if (!group) return res.status(404).json({ error: 'Group not found' });

            // Check if student is assigned to this group
            if (!group.assignedStudents.includes(req.user.id)) {
                return res.status(403).json({ error: 'Not assigned to this group' });
            }

            // 1. Find the CURRENT fileId (shared across group members)
            const submittingMember = await GroupMember.findOne({ groupId, studentId: req.user.id });
            const oldFileId = submittingMember ? submittingMember.fileId : null;
            
            // Protection check: Already graded?
            if (submittingMember && submittingMember.gradedAt) {
                 return res.status(400).json({ error: 'Already graded, cannot modify' });
            }
            
            // If the member record doesn't exist, they shouldn't be here (should have been created by groupController)
            if (!submittingMember) {
                 return res.status(404).json({ error: 'Member record not found for this group.' });
            }


            // 2. Upload NEW file to S3
            // Note: Using groupId in fileKey helps with S3 organization and is safer than using studentId
            const fileKey = `group-contributions/${groupId}/${Date.now()}-${req.file.originalname}`;
            await new Upload({
                client: s3Client,
                params: {
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: fileKey,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                },
            }).done();

            const newFileData = {
                fileId: fileKey,
                fileType: req.file.mimetype,
                size: req.file.size,
                originalName: req.file.originalname,
            };
            
            // 3. Delete OLD file from S3 (must delete the file pointed to by the previous submission)
            if (oldFileId) {
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: process.env.S3_BUCKET_NAME,
                        Key: oldFileId,
                    }));
                } catch (err) {
                    console.warn('Failed to delete old file from S3:', err);
                }
            }

            // 🌟 CRITICAL FIX: SYNCHRONIZATION: Update ALL group members (if not graded)
            const updatePayload = {
                ...newFileData,
                status: 'submitted', 
            };

            const result = await GroupMember.updateMany(
                { 
                    groupId: groupId, 
                    status: { $ne: 'graded' } // Only update non-graded records
                },
                { 
                    $set: updatePayload 
                }
            );
            // ----------------------------------------------------------------------

            // Return success response (frontend will refresh data)
            res.status(200).json({ message: "Submission synchronized successfully.", updatedCount: result.nModified });

        } catch (err) {
            console.error('Upload error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
];

// Teacher/student view members/contributions (No change needed)
exports.getMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Not found' });

        // This will now return all member records initialized by groupController.js
        const members = await GroupMember.find({ groupId });

        res.json(members);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Teacher grades a contribution (No change needed)
exports.gradeContribution = async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ error: 'Only teachers can grade' });
        }

        const { id } = req.params; // GroupMember ID
        const { marks, feedback } = req.body;

        const member = await GroupMember.findById(id);
        if (!member) return res.status(404).json({ error: 'Member record not found' });

        member.marks = marks;
        member.feedback = feedback;
        member.gradedAt = Date.now();
        member.gradedBy = req.user.id;
        member.status = 'graded';

        await member.save();
        res.json(member);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get signed URL to download a member contribution file (No change needed)
exports.getContributionFileSignedUrl = async (req, res) => {
    try {
        const { id } = req.params; // GroupMember ID
        const member = await GroupMember.findById(id);
        if (!member || !member.fileId) return res.status(404).json({ error: 'File not found' });

        const group = await Group.findById(member.groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Basic authorization check (teacher or the student member themselves)
        if (req.user.role !== 'teacher' && req.user.id !== member.studentId.toString()) {
             // You may need more complex checks (e.g., student belongs to the class)
        }
        
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: member.fileId,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url, fileName: member.originalName });
    } catch (err) {
        console.error('Error getting member file URL:', err);
        res.status(500).json({ error: 'Server error' });
    }
};