const express = require('express');
const router = express.Router();
const User = require('../models/User');
const VerificationToken = require('../models/VerificationToken');

router.get('/verify-email/:token', async (req, res) => {
  try {
    const tokenDoc = await VerificationToken.findOne({ token: req.params.token });
    if (!tokenDoc) {
      return res.status(400).send('Invalid or expired verification link.');
    }

    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      return res.status(404).send('User not found.');
    }

    user.verified = true;
    await user.save();
    await VerificationToken.findByIdAndDelete(tokenDoc._id);

    res.send('Email verified successfully. You can now log in.');
  } catch (error) {
    res.status(500).send('Something went wrong.');
  }
});

module.exports = router;
