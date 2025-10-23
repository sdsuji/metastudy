const mongoose = require('mongoose');

// Schema for folders inside each classroom
const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private'
  }
});

// Main Classroom Schema
const classroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  section: String,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Code to join the class
  code: {
    type: String,
    unique: true,
    required: true
  },

  // List of students who joined
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Auto-generated folders for organizing content
  folders: [folderSchema]

}, { timestamps: true });

module.exports = mongoose.model('Classroom', classroomSchema);
