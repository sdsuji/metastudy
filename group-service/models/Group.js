// models/Group.js
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Class',
    },
    uploader: { // Teacher who created the group
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    title: { // Group Name
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    fileId: String,          // S3 key (e.g., Group-related file/document)
    fileType: String,
    size: Number,
    originalName: String,
    assignedStudents: [ // Students explicitly assigned to this group
        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ],
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
});

groupSchema.set("timestamps", true);

module.exports = mongoose.model('Group', groupSchema);