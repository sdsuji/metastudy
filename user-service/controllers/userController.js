const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const VerificationToken = require('../models/VerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');

exports.register = async (req, res) => {
    console.log("Received data:", req.body);
    const {
        name,
        email,
        password,
        role,
        gender,
        department,
        rollNo,
        staffId,
        //subject,
    } = req.body;

    const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    if (!strongPasswordRegex.test(password)) {
        return res.status(400).json({
            msg: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
        });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ msg: 'User already exists' });

        if (role === 'student') {
            if (!gender || !department || !rollNo) {
                return res.status(400).json({ msg: 'Missing student fields' });
            }

            const existingRollNo = await User.findOne({ rollNo });
            if (existingRollNo) return res.status(400).json({ msg: 'Roll Number already exists' });
        }

        if (role === 'teacher') {
            if (!staffId || !department) {
                return res.status(400).json({ msg: 'Missing teacher fields' });
            }

            const existingStaffId = await User.findOne({ staffId });
            if (existingStaffId) return res.status(400).json({ msg: 'Staff ID already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role,
            gender,
            department,
            rollNo,
            staffId,
            //subject,
            isVerified: false,
        });

        const verificationToken = crypto.randomBytes(32).toString('hex');

        try {
            const tokenDoc = await VerificationToken.create({
                userId: newUser._id,
                token: verificationToken,
            });
            console.log('Verification token saved:', tokenDoc);
        } catch (tokenError) {
            console.error('Failed to save verification token:', tokenError);
            return res.status(500).json({ msg: 'Could not generate verification token' });
        }

        const verifyLink = `${process.env.BASE_URL}/api/users/verify-email/${verificationToken}`;

        await sendEmail(
            email,
            'Verify Your Email',
            `<h3>Hello ${name},</h3>
             <p>Thank you for registering. Please verify your email by clicking the link below:</p>
             <a href="${verifyLink}">Verify Email</a>`
        );

        res.status(201).json({
            msg: 'Registration successful. Please check your email to verify your account.',
        });
    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Email not registered' });

        if (!user.isVerified) {
            return res.status(401).json({ msg: 'Please verify your email before logging in' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid password' });

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role,
                name: user.name,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({ user, token });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const tokenDoc = await VerificationToken.findOne({ token });

        if (!tokenDoc) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                    <title>Link Expired</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            background: radial-gradient(
                                circle at 0% 0%,
                                #fbfbfb,
                                #e8f9ff,
                                #c4d9ff,
                                #c5baff
                            );
                            color: white;
                            text-align: center;
                        }
                        .box {
                            background: rgba(255, 255, 255, 0.1);
                            padding: 40px 60px;
                            border-radius: 15px;
                            backdrop-filter: blur(8px);
                            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                        }
                        h1 {
                            font-size: 2rem;
                            margin-bottom: 20px;
                        }
                        p {
                            font-size: 1.1rem;
                        }
                        .btn {
                            margin-top: 25px;
                            padding: 10px 20px;
                            background-color: #ffffff;
                            color: #333;
                            border: none;
                            border-radius: 5px;
                            text-decoration: none;
                            font-weight: bold;
                            transition: 0.3s ease;
                        }
                        .btn:hover {
                            background-color: #f0f0f0;
                            color: #000;
                        }
                    </style>
                </head>
                <body>
                    <div class="box">
                        <h1>Verification Link Expired</h1>
                        <p>The verification link is invalid or has expired. Please register again.</p>
                        <a href="http://localhost:5173/register" class="btn">Go to Register</a>
                    </div>
                </body>
                </html>
            `);
        }

        const user = await User.findById(tokenDoc.userId);
        if (!user) return res.status(400).send('User not found');

        if (user.isVerified) {
            return res.status(200).send('Email already verified');
        }

        user.isVerified = true;
        await user.save();
        await VerificationToken.deleteOne({ _id: tokenDoc._id });

        console.log(`Email verified for user: ${user.email}`);

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <title>Email Verified</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: radial-gradient(
                            circle at 0% 0%,
                            #fbfbfb,
                            #e8f9ff,
                            #c4d9ff,
                            #c5baff
                        );
                        color: white;
                        text-align: center;
                    }
                    .box {
                        background: rgba(255, 255, 255, 0.1);
                        padding: 40px 60px;
                        border-radius: 15px;
                        backdrop-filter: blur(8px);
                        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                    }
                    h1 {
                        font-size: 2rem;
                        margin-bottom: 20px;
                    }
                    p {
                        font-size: 1.1rem;
                    }
                    .btn {
                        margin-top: 25px;
                        padding: 10px 20px;
                        background-color: #ffffff;
                        color: #333;
                        border: none;
                        border-radius: 5px;
                        text-decoration: none;
                        font-weight: bold;
                        transition: 0.3s ease;
                    }
                    .btn:hover {
                        background-color: #f0f0f0;
                        color: #000;
                    }
                </style>
            </head>
            <body>
                <div class="box">
                    <h1>Email Verified!</h1>
                    <p>Your email has been verified successfully. You can now log in.</p>
                    <a href="http://localhost:5173/option" class="btn">Go to Login</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Email verification error:', err.message);
        res.status(500).send('Something went wrong. Please try again later.');
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Email not registered' });

        const token = crypto.randomBytes(32).toString('hex');

        await PasswordResetToken.findOneAndDelete({ userId: user._id });

        await PasswordResetToken.create({
            userId: user._id,
            token
        });

        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

        await sendEmail(
            user.email,
            'Reset Your Password',
            `<p>Hello ${user.name},</p>
               <p>You requested to reset your password. Click below to reset it:</p>
               <a href="${resetLink}">Reset Password</a>
               <p>This link will expire in 1 hour.</p>`
        );

        res.status(200).json({ msg: 'Reset link sent to your email' });
    } catch (error) {
        console.error('Forgot Password error:', error.message);
        res.status(500).json({ msg: 'Internal server error' });
    }
};

exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        const tokenDoc = await PasswordResetToken.findOne({ token });
        if (!tokenDoc) return res.status(400).json({ msg: 'Invalid or expired token' });

        const user = await User.findById(tokenDoc.userId);
        if (!user) return res.status(400).json({ msg: 'User not found' });

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!strongPasswordRegex.test(password)) {
            return res.status(400).json({
                msg: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
            });
        }

        user.password = await bcrypt.hash(password, 10);
        await user.save();
        await PasswordResetToken.findByIdAndDelete(tokenDoc._id);

        res.status(200).json({ msg: 'Password reset successful. You can now log in.' });
    } catch (error) {
        console.error('Reset Password error:', error.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

// ** NEW FUNCTION FOR STUDENT LOOKUP **
exports.getStudentsByClass = async (req, res) => {
    try {
        const { classId } = req.params;

        // Ensure the classId is provided and the user requesting is a teacher (optional, but good practice)
        if (!classId) {
            return res.status(400).json({ msg: 'Missing class ID' });
        }
        
        // Query the database for users who are students AND belong to the specific classId.
        const students = await User.find({
            role: 'student',
            classId: classId 
        }).select('name _id email rollNo'); // Only return necessary fields

        // Return the list of students (or an empty array if none are found)
        res.json(students);
    } catch (err) {
        console.error('Error fetching students by class:', err);
        // This catch block will handle CastError if an invalid classId format is passed
        res.status(500).json({ msg: 'Server error fetching students.' });
    }
};

exports.getUsersInBatch = (req, res) => {
    // This is a placeholder. The actual logic is implemented in the router.
    return res.status(501).json({ msg: 'Function not implemented in controller, check router.' });
}
// ** NEW FUNCTION FOR STUDENT LOOKUP **
exports.getStudentsByClass = async (req, res) => {
    try {
        const { classId } = req.params;

        // Ensure the classId is provided and the user requesting is a teacher (optional, but good practice)
        if (!classId) {
            return res.status(400).json({ msg: 'Missing class ID' });
        }
        
        // Query the database for users who are students AND belong to the specific classId.
        const students = await User.find({
            role: 'student',
            classId: classId 
        }).select('name _id email rollNo'); // Only return necessary fields

        // Return the list of students (or an empty array if none are found)
        res.json(students);
    } catch (err) {
        console.error('Error fetching students by class:', err);
        // This catch block will handle CastError if an invalid classId format is passed
        res.status(500).json({ msg: 'Server error fetching students.' });
    }
};