const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authMiddleware = require('../middleware/auth');

// Student: upload or edit submission (before grading)
router.post('/upload', authMiddleware, submissionController.uploadSubmission);

// Get all submissions for a presentation (teacher & students)
router.get('/:presentationId', authMiddleware, submissionController.getSubmissions);

// Teacher: grade a submission
router.put('/grade/:id', authMiddleware, submissionController.gradeSubmission);

// Download submission file (signed URL)
router.get('/file/:id', authMiddleware, submissionController.getSubmissionFileSignedUrl);

module.exports = router;
