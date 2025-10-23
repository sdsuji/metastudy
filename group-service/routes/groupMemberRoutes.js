// routes/groupMemberRoutes.js
const express = require('express');
const router = express.Router();
const memberController = require('../controllers/groupMemberController'); // Renamed controller
const authMiddleware = require('../middleware/auth');

// Student: upload or edit contribution (before grading)
router.post('/upload', authMiddleware, memberController.uploadContribution);

// Get all members/contributions for a group (teacher & students)
router.get('/:groupId', authMiddleware, memberController.getMembers);

// Teacher: grade a contribution
router.put('/grade/:id', authMiddleware, memberController.gradeContribution);

// Download contribution file (signed URL)
router.get('/file/:id', authMiddleware, memberController.getContributionFileSignedUrl);

module.exports = router;