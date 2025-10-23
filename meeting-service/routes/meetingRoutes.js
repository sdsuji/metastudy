const express = require('express');
const router = express.Router();
const { createMeeting, getMeetingByClass } = require('../controllers/meetingController');
const { verifyToken } = require('../middleware/auth');

router.post('/create', verifyToken, createMeeting);
router.get('/class/:classId', verifyToken, getMeetingByClass);

module.exports = router;
