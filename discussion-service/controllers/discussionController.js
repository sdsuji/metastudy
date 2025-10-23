const Discussion = require('../models/Discussion');

// GET discussions for a class
exports.getDiscussionsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const discussions = await Discussion.find({ classId }).sort({ postedAt: -1 });
    res.json({ discussions });
  } catch (err) {
    console.error('GET DISCUSSIONS ERROR:', err);
    res.status(500).json({ message: 'Failed to get discussions' });
  }
};

// POST new discussion
exports.postDiscussion = async (req, res) => {
  try {
    const { content, classId } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;

    const newDiscussion = new Discussion({
      classId,
      author: userId,
      authorName: userName,
      content,
    });

    await newDiscussion.save();
    res.status(201).json({ message: 'Posted', discussion: newDiscussion });
  } catch (err) {
    console.error('POST DISCUSSION ERROR:', err);
    res.status(500).json({ message: 'Failed to post discussion' });
  }
};

// DELETE discussion
exports.deleteDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: 'Not found' });

    const isOwner = discussion.author.toString() === req.user.id;
    const isTeacher = req.user.role === 'teacher';

    if (!isOwner && !isTeacher) {
      return res.status(403).json({ message: 'Unauthorized to delete this post' });
    }

    await discussion.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE ERROR:', err);
    res.status(500).json({ message: 'Failed to delete' });
  }
};

// PUT: Edit a discussion (by who pasted)
exports.editDiscussionContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id; // This is the string ID

    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: 'Discussion not found' });

    //  Convert the Mongoose ObjectId to a string for comparison.
    const isOwner = discussion.author.toString() === userId; 
    
    // Check if the user is the owner OR a teacher (for full control)
    const isTeacher = req.user.role === 'teacher';

    if (!isOwner && !isTeacher) { // Allow if either is true
        return res.status(403).json({ message: 'Unauthorized to edit this post' });
    }
    
    // Optional: Add word limit check (Good practice to keep this)
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount > 500) { 
        return res.status(400).json({ message: 'Edited discussion content exceeds 500 word limit' });
    }

    discussion.content = content;
    await discussion.save();

    res.json({ message: 'Post updated', discussion });
  } catch (err) {
    console.error('EDIT DISCUSSION ERROR:', err);
    res.status(500).json({ message: 'Failed to edit post' });
  }
};

// POST: Add comment
exports.addCommentToDiscussion = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;

    // Word limit check
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount > 500) {
      return res.status(400).json({ message: 'Comment exceeds 500 word limit' });
    }

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) return res.status(404).json({ message: 'Discussion not found' });

    discussion.comments.push({
      author: userId,
      authorName: userName,
      content,
    });

    await discussion.save();
    res.status(201).json({ message: 'Comment added', discussion });
  } catch (err) {
    console.error('ADD COMMENT ERROR:', err);
    res.status(500).json({ message: 'Failed to add comment' });
  }
};


// DELETE: Comment (by student or teacher)
exports.deleteCommentFromDiscussion = async (req, res) => {
  try {
    const { discussionId, commentId } = req.params;
    const user = req.user;

    console.log('Deleting comment', commentId, 'from discussion', discussionId);

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) return res.status(404).json({ message: 'Discussion not found' });

    const comment = discussion.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const isOwner = String(comment.author) === String(user.id);
    const isTeacher = user.role === 'teacher';

    if (!isOwner && !isTeacher) {
      return res.status(403).json({ message: 'Unauthorized to delete this comment' });
    }

  
    discussion.comments.pull({ _id: commentId });

    await discussion.save();
    res.json({ message: 'Comment deleted', discussion });
  } catch (err) {
    console.error('DELETE COMMENT ERROR:', err);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
};



// PUT: Edit comment (by author only)
exports.editComment = async (req, res) => {
  try {
    const { discussionId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Word limit check
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount > 500) {
      return res.status(400).json({ message: 'Edited comment exceeds 500 word limit' });
    }

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) return res.status(404).json({ message: 'Discussion not found' });

    const comment = discussion.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.author.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized to edit this comment' });
    }

    comment.content = content;
    await discussion.save();
    res.json({ message: 'Comment edited', discussion });
  } catch (err) {
    console.error('EDIT COMMENT ERROR:', err);
    res.status(500).json({ message: 'Failed to edit comment' });
  }
};


