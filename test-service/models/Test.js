const mongoose = require("mongoose");

const testSchema = new mongoose.Schema({
    classId: { type: mongoose.Schema.Types.ObjectId, required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    
    questionFileId: { type: String }, // S3 key for test template
    fileType: { type: String },
    originalName: { type: String },
    
    gradingMethod: { 
        type: String, 
        enum: ['manual', 'auto'], 
        default: 'manual', 
        required: true 
    },
    solutionFileId: { type: String }, // S3 key for answer key
    
    uploadedAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
});

module.exports = mongoose.model("Test", testSchema);