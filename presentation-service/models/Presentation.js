// models/Presentation.js
const mongoose = require('mongoose');

const presentationSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Class',
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // teacher id
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  fileId: String,        // S3 key
  fileType: String,
  size: Number,
  originalName: String,
  assignedStudents: [
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

// Auto-manage createdAt and updatedAt
presentationSchema.set("timestamps", true);

module.exports = mongoose.model('Presentation', presentationSchema);



