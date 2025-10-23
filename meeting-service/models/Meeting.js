const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roomId: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Meeting', meetingSchema);
