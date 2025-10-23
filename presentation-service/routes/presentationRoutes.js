const express = require('express');
const router = express.Router();
const presentationController = require('../controllers/presentationController');
const authMiddleware = require('../middleware/auth');

// Teacher: create presentation
router.post('/', authMiddleware, presentationController.createPresentation);

// Get all presentations of a class (students & teachers)
router.get('/class/:classId', authMiddleware, presentationController.getPresentationsByClass);

// Get signed URL for presentation file (teacher/student)
router.get('/:id/file', authMiddleware, presentationController.getPresentationFileSignedUrl);

// Teacher: update presentation
router.put('/:id', authMiddleware, presentationController.updatePresentation); // <-- ADD THIS LINE

// Teacher: delete presentation (cascade delete submissions)
router.delete('/:id', authMiddleware, presentationController.deletePresentation);

module.exports = router;
