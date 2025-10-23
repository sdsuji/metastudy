const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    
    fileId: { type: String }, // S3 key
    fileType: { type: String },
    originalName: String,
    uploadedAt: { type: Date, default: Date.now },

    marks: { type: Number, min: 0, default: null },
    feedback: { type: String, default: "" },
    gradedAt: { type: Date },
    gradedBy: { type: mongoose.Schema.Types.Mixed },

    autoGradeStatus: { 
        type: String, 
        enum: ['pending', 'extracted', 'scored', 'error'], 
        default: 'pending' 
    },
});

submissionSchema.index({ testId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("TestSubmission", submissionSchema);