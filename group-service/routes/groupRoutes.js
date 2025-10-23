// routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');

// Teacher: create group
router.post('/', authMiddleware, groupController.createGroup);

// Get all groups of a class (students & teachers)
router.get('/class/:classId', authMiddleware, groupController.getGroupsByClass);

// Get signed URL for group file (teacher/student)
router.get('/:id/file', authMiddleware, groupController.getGroupFileSignedUrl);

// Teacher: update group
router.put('/:id', authMiddleware, groupController.updateGroup);

// Teacher: delete group (cascade delete members)
router.delete('/:id', authMiddleware, groupController.deleteGroup);

module.exports = router;