const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fileId: { type: String }, // S3 key
  fileType: { type: String },
  size: { type: Number },
  originalName: String,
  uploadedAt: { type: Date, default: Date.now },

  // Grading fields
  marks: { type: Number, min: 0, default: null },
  feedback: { type: String, default: "" },
  gradedAt: { type: Date },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// UNIQUE INDEX to ensure one submission per student per assignment
submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });


module.exports = mongoose.model("Submission", submissionSchema);

