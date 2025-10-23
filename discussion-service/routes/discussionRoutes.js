const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

const {
  postDiscussion,
  getDiscussionsByClass,
  deleteDiscussion,
  editDiscussionContent,
  addCommentToDiscussion,
  deleteCommentFromDiscussion,
  editComment
} = require('../controllers/discussionController');

// Get all discussions in a class
router.get('/class/:classId', verifyToken, getDiscussionsByClass);

// Post a new discussion
router.post('/', verifyToken, postDiscussion);

// Delete a discussion
router.delete('/:id', verifyToken, deleteDiscussion);

// Edit a discussion
router.put('/:id', verifyToken, editDiscussionContent);

// Add a comment to a discussion
router.post('/:discussionId/comments', verifyToken, addCommentToDiscussion);

// Delete a comment from a discussion
router.delete('/:discussionId/comments/:commentId', verifyToken, deleteCommentFromDiscussion);

// Edit a comment
router.put('/:discussionId/comments/:commentId', verifyToken, editComment);

module.exports = router;
