const express = require('express');
const router = express.Router();
const Classroom = require('../models/Classroom');
const auth = require('../middleware/auth');
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const axios = require('axios');
const USER_SERVICE_URL = 'http://localhost:5000/api/users';
router.post('/create', auth, async (req, res) => {
  try {
    const { name, subject, section } = req.body;
    const createdBy = req.user.id;

    const classroom = new Classroom({
  name,
  subject,
  section,
  createdBy,
  code: generateCode(), 
  folders: [
    { name: 'Materials', visibility: 'public' },
    { name: 'Test Submissions', visibility: 'private' },
    { name: 'Assignment Materials', visibility: 'private' },
    { name: 'Presentation Materials', visibility: 'private' },
    { name: 'Discussion Forum', visibility: 'public' },
    { name: 'Groups', visibility: 'private' }
  ]
});

    await classroom.save();
    res.status(201).json({ msg: 'Classroom created successfully', classroom });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let classrooms;

    if (userRole === 'teacher') {
      // Show classrooms created by this teacher
      classrooms = await Classroom.find({ createdBy: userId });
    } else {
      // Show classrooms this student has joined
      classrooms = await Classroom.find({ students: userId });
    }

    res.status(200).json({ classrooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error fetching classrooms' });
  }
});
router.post('/join', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { code } = req.body;

    if (role !== 'student') {
      return res.status(403).json({ msg: 'Only students can join a class' });
    }

    const classroom = await Classroom.findOne({ code });
    if (!classroom) {
      return res.status(404).json({ msg: 'Classroom not found with this code' });
    }

    // Check if already joined
    if (classroom.students.includes(userId)) {
      return res.status(400).json({ msg: 'Already joined this class' });
    }

    // Add student
    classroom.students.push(userId);
    await classroom.save();

    res.status(200).json({ msg: 'Successfully joined the class', classroom });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to join classroom' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });
    res.status(200).json({ classroom });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to load classroom' });
  }
});
// routes/classroomRoutes.js (Add this block at the end)

// NEW: Get the list of student IDs for a specific class
router.get('/:classId/student-ids', auth, async (req, res) => {
    try {
        const { classId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const classroom = await Classroom.findById(classId).select('createdBy students');

        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        // Security check: Only the teacher who created the class can see the list
        if (userRole !== 'teacher' || classroom.createdBy.toString() !== userId) {
            return res.status(403).json({ msg: 'Access denied. You are not the instructor for this class.' });
        }

        // The 'students' array contains only the student ObjectIds (User IDs)
        // converting the array of ObjectIds to an array of strings for easy frontend use
        const studentIds = classroom.students.map(id => id.toString());

        res.status(200).json({ studentIds });
    } catch (err) {
        console.error('Error fetching student IDs:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});
// NEW: Get the list of student IDs for a specific class (Permissive for Grouping)
// This route allows access to the creator (teacher) AND any enrolled student,
// enabling students to see the member list necessary for forming groups.
router.get('/:classId/student-ids-for-grouping', auth, async (req, res) => {
    try {
        const { classId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const classroom = await Classroom.findById(classId).select('createdBy students');

        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        const studentIdsAsStrings = classroom.students.map(id => id.toString());
        const isCreator = classroom.createdBy.toString() === userId;
        const isMember = userRole === 'student' && studentIdsAsStrings.includes(userId);

        // Security check: Allow creator OR enrolled student to access
        if (!isCreator && !isMember) {
             return res.status(403).json({ msg: 'Access denied. You must be the instructor or an enrolled student to fetch the member list for grouping.' });
        }
        
        // Returning the student IDs
        res.status(200).json({ studentIds: studentIdsAsStrings });
    } catch (err) {
        console.error('Error fetching student IDs for grouping:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});
// ==========================================================
// ✅ NEW ROUTE: Get Class Members (Teacher or Enrolled Student)
// ==========================================================
router.get('/:classId/members', auth, async (req, res) => {
    try {
        const { classId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const classroom = await Classroom.findById(classId).select('createdBy students');

        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        const creatorId = classroom.createdBy.toString();
        const studentIds = classroom.students.map(id => id.toString());

        // Check if the user is the teacher or an enrolled student
        const isCreator = creatorId === userId;
        const isMember = userRole === 'student' && studentIds.includes(userId);

        if (!isCreator && !isMember) {
            return res.status(403).json({ msg: 'Access denied. You are not a member of this class.' });
        }

        // 1. Compile all unique user IDs for the class
        const memberIds = Array.from(new Set([creatorId, ...studentIds]));

        // 2. Request user details from the User Service
        // We use POST to send a list of IDs in the body, which is better than GET query params.
        const userRes = await axios.post(`${USER_SERVICE_URL}/details-by-ids`, { userIds: memberIds }, {
            headers: { Authorization: req.header('Authorization') }
        });

        const members = userRes.data.users; // Expected array of { _id, name, role }

        res.status(200).json({ members });
    } catch (err) {
        console.error('Error fetching class members:', err.message);
        if (err.response) console.error('User Service Response:', err.response.data);
        res.status(500).json({ msg: 'Server error fetching class members' });
    }
});

// ==========================================================
// ✅ NEW ROUTE: Remove Student (Teacher Only)
// ==========================================================
router.delete('/:classId/members/:studentId', auth, async (req, res) => {
    try {
        const { classId, studentId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 1. Find the classroom
        const classroom = await Classroom.findById(classId);

        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        // 2. Security Check: Must be the teacher (creator)
        if (userRole !== 'teacher' || classroom.createdBy.toString() !== userId) {
            return res.status(403).json({ msg: 'Access denied. Only the instructor can remove students.' });
        }

        // 3. Security Check: Cannot remove the teacher (creator)
        if (studentId === userId) {
            return res.status(400).json({ msg: "Cannot remove yourself as the class instructor." });
        }

        // 4. Check if the student ID exists in the students array
        const studentIndex = classroom.students.findIndex(
            id => id.toString() === studentId
        );

        if (studentIndex === -1) {
            return res.status(404).json({ msg: 'Student not found in this class.' });
        }

        // 5. Remove the student
        classroom.students.splice(studentIndex, 1);
        await classroom.save();

        res.status(200).json({ msg: 'Student successfully removed from the class.' });
    } catch (err) {
        console.error('Error removing student:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});
// ==========================================================
// ✅ NEW ROUTE: Delete Class (Teacher Only)
// ==========================================================
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id: classId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (userRole !== 'teacher') {
            return res.status(403).json({ msg: 'Access denied. Only the class instructor can delete the class.' });
        }

        // Find the class and ensure the requesting user is the creator
        const result = await Classroom.deleteOne({
            _id: classId,
            createdBy: userId
        });

        if (result.deletedCount === 0) {
            // Check if the class exists but the user is not the creator, or if the class doesn't exist at all
            const exists = await Classroom.findById(classId);
            if (exists) {
                return res.status(403).json({ msg: 'Access denied. You are not the creator of this class.' });
            }
            return res.status(404).json({ msg: 'Classroom not found.' });
        }

        // Note: MongoDB handles removing the document; students will no longer see it in /my endpoint.
        res.status(200).json({ msg: 'Classroom deleted successfully.' });

    } catch (err) {
        console.error('Error deleting classroom:', err);
        res.status(500).json({ msg: 'Server error during class deletion.' });
    }
});

router.get('/:classId/student-roster-ids', auth, async (req, res) => {
    try {
        const { classId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const classroom = await Classroom.findById(classId).select('createdBy students');

        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        const studentIdsAsStrings = classroom.students.map(id => id.toString());
        const isCreator = classroom.createdBy.toString() === userId;
        const isMember = userRole === 'student' && studentIdsAsStrings.includes(userId);

        // Security check: Allow creator (teacher) OR enrolled student to access
        if (!isCreator && !isMember) {
            return res.status(403).json({ msg: 'Access denied. You are not a member of this class.' });
        }

        // Returning the student IDs
        res.status(200).json({ studentIds: studentIdsAsStrings });
    } catch (err) {
        console.error('Error fetching student roster IDs:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});
module.exports = router;
