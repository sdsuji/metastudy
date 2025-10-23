const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String },
  fileId: { type: String }, // S3 key
  fileType: { type: String },
  size: { type: Number },
  originalName: { type: String },
  uploadedAt: { type: Date, default: Date.now },

  dueDate: { type: Date, required: true }, // deadline
  lastUpdated: { type: Date, default: Date.now }, // track updates
});

module.exports = mongoose.model("Assignment", assignmentSchema);
