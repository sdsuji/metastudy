const express = require('express');
const router = express.Router();
const verifyToken = require('../authMiddleware'); 
const User = require('../models/User');
const mongoose = require('mongoose'); 

const {
    register,
    login,
    verifyEmail,
    forgotPassword,
    resetPassword,
    getStudentsByClass, 
} = require('../controllers/userController'); 

// ==========================================================
// 🚨 EXISTING ROUTE: DO NOT REMOVE/RENAME (Used by other service)
// Filters for 'student' role.
// ==========================================================
router.get('/batch', async (req, res) => {
    try {
        const { ids } = req.query; // Expects: ?ids=id1,id2,id3
        if (!ids) return res.status(400).json({ msg: 'Missing IDs query parameter' });

        const idArray = ids.split(',').filter(id => id.trim() !== '');

        // Validate and convert strings to Mongoose ObjectIds (Fix for 500 error)
        const validObjectIds = idArray
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validObjectIds.length === 0 && idArray.length > 0) {
            return res.status(400).json({ msg: 'Invalid user IDs provided' });
        }
        
        const users = await User.find({
            _id: { $in: validObjectIds },
            role: 'student' // Explicitly filters for students
        }).select('name _id email rollNo');

        res.json(users);
    } catch (err) {
        console.error('Batch user fetch error (old route):', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});


// ==========================================================
// ✅ NEW/FIXED ROUTE: /batch-users (Used by Group Service)
// General batch lookup for ANY user type (students/teachers)
// ==========================================================
router.get('/batch-users', async (req, res) => { 
    try {
        const { ids } = req.query; // Expects: ?ids=id1,id2,id3
        if (!ids) return res.status(200).json([]);

        const idArray = ids.split(',').filter(id => id.trim() !== '');

        // Validate and convert strings to Mongoose ObjectIds 
        const validObjectIds = idArray
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validObjectIds.length === 0 && idArray.length > 0) {
            return res.status(400).json({ msg: 'Invalid user IDs provided' });
        }
        
        // NO role filter, fetching all user types and necessary fields
        const users = await User.find({
            _id: { $in: validObjectIds },
        }).select('name _id email rollNo staffId role'); 

        res.json(users);
    } catch (err) {
        console.error('General batch user fetch error (new route):', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});


// ==========================================================
// Other Standard Routes
// ==========================================================

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Get students in a specific class
router.get('/students/class/:classId', verifyToken, getStudentsByClass);

// Protected route: Get user by ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password'); 
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// INTERNAL route for other services (no auth required, minimal info)
router.get('/:id/internal', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('name email _id'); 
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ==========================================================
// ✅ NEW ROUTE: Fetch Users by IDs (POST - Used by Classroom Service)
// ==========================================================
router.post('/details-by-ids', async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ msg: 'Missing or invalid userIds array in request body.' });
        }

        // Validate and convert strings to Mongoose ObjectIds
        const validObjectIds = userIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validObjectIds.length === 0 && userIds.length > 0) {
            return res.status(400).json({ msg: 'No valid user IDs provided.' });
        }

        // Fetch user details, including name, _id, and role
        const users = await User.find({
            _id: { $in: validObjectIds },
        }).select('name _id role'); // Only select the fields needed by the classroom service

        res.status(200).json({ users });
    } catch (err) {
        console.error('Details by ID batch fetch error:', err);
        res.status(500).json({ msg: 'Server error fetching user details.', error: err.message });
    }
});
module.exports = router;