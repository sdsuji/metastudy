// models/GroupMember.js
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Group',
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    fileId: String,          // S3 key (Student's contribution file)
    fileType: String,
    size: Number,
    originalName: String,
    marks: { // Grade for the student's group contribution
        type: Number,
        default: null,
    },
    feedback: {
        type: String,
        default: '',
    },
    gradedAt: {
        type: Date,
        default: null,
    },
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    status: {
        type: String,
        enum: ["submitted", "graded", "assigned"], // Using 'assigned' as a default status for membership
        default: "assigned",
    },
});

// enforce 1 record per student per group (membership/contribution)
memberSchema.index({ groupId: 1, studentId: 1 }, { unique: true });

memberSchema.set("timestamps", true);

module.exports = mongoose.model('GroupMember', memberSchema);