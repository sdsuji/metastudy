const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  originalName: { type: String },
  fileType: { type: String },
  fileId: { type: String }, // S3 key
  size: { type: Number },
  isLink: { type: Boolean, default: false },
  linkUrl: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Material", materialSchema);
