// models/PresentationSubmission.js
const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  presentationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Presentation',
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  fileId: String,        // S3 key
  fileType: String,
  size: Number,
  originalName: String,
  marks: {
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
    enum: ["submitted", "graded"],
    default: "submitted",
  },
});

// enforce 1 submission per student per presentation
submissionSchema.index({ presentationId: 1, studentId: 1 }, { unique: true });

// Auto-manage createdAt and updatedAt
submissionSchema.set("timestamps", true);

module.exports = mongoose.model('PresentationSubmission', submissionSchema);
