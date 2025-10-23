const Meeting = require('../models/Meeting');

exports.createMeeting = async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ msg: 'Only teachers can create meetings' });

    const { classId } = req.body;
    const roomId = 'classroom-' + Math.random().toString(36).substr(2, 8);

    const newMeeting = new Meeting({ classId, teacher: req.user.id, roomId });
    await newMeeting.save();

    res.json(newMeeting);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to create meeting', error: err.message });
  }
};

exports.getMeetingByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const meeting = await Meeting.findOne({ classId }).sort({ startTime: -1 });
    if (!meeting) return res.status(404).json({ msg: 'No meeting found' });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch meeting', error: err.message });
  }
};
