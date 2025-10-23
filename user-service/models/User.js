const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ['student', 'teacher'],
    required: true,
  },

  department: String,

  // Student(alone has)
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  rollNo: String,

  // Teacher(alone has)
  staffId: String,
  //subject: String,

  // Email verification
  isVerified: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
