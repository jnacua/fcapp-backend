const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const Audit = require('../models/auditModel'); 
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken'); 
const { protect, restrictTo } = require('../middleware/authMiddleware');

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'proof-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 1. REGISTRATION ---
router.post('/register', upload.single('proofImage'), async (req, res) => {
    try {
        const { email, password, mobileNumber, blockLot, name } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            email,
            password: hashedPassword,
            mobileNumber,
            blockLot,
            name,
            role: 'resident', 
            status: 'pending', 
            proofOfResidencyPath: req.file ? req.file.path.replace(/\\/g, "/") : null 
        });

        await newUser.save();
        return res.status(200).json({ message: "Success" });
    } catch (err) {
        return res.status(500).json({ message: "Registration failed", error: err.message });
    }
});

// --- 2. LOGIN ---
router.post('/login', async (req, res) => {
    try {
        const { email, password, isAdminLogin } = req.body; 

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Admin Security Check (Case-insensitive)
        if (isAdminLogin && user.role.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ message: "Access Denied: Only Admins can enter here." });
        }

        // Resident Approval Check
        if (user.role === 'resident') {
            const status = user.status.toLowerCase();
            if (status === 'pending') {
                return res.status(403).json({ message: "Wait for admin approval" });
            }
            if (status === 'rejected' || status === 'archived') {
                return res.status(403).json({ message: "Account inactive. Contact admin." });
            }
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET || 'lebronjames23', 
            { expiresIn: '30d' }
        );

        return res.status(200).json({ 
            message: "Login successful", 
            token: token, 
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                blockLot: user.blockLot || user.blocklot || 'N/A',
                profileImage: user.profileImage || null
            } 
        });

    } catch (err) {
        return res.status(500).json({ message: "Login error" });
    }
});

// --- GET ME ---
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: "User not found" });
        
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            blockLot: user.blockLot || user.blocklot || 'N/A',
            profileImage: user.profileImage || null
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// --- 3. FORGOT PASSWORD ---
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body; 
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOtp = otp;
        user.resetOtpExpires = Date.now() + 600000; 
        await user.save();
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'FCAPP - Password Reset OTP',
            html: `<h2>Password Reset</h2><p>Your code is: <b>${otp}</b></p>`
        };

        await req.transporter.sendMail(mailOptions);
        return res.status(200).json({ message: "OTP sent" });
    } catch (err) { 
        return res.status(500).json({ message: "Error sending email" }); 
    }
});

// --- 4. VERIFY OTP ---
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ 
            email: email, 
            resetOtp: otp, 
            resetOtpExpires: { $gt: Date.now() } 
        });
        if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });
        return res.status(200).json({ message: "Verified" });
    } catch (err) {
        return res.status(500).json({ message: "Error" });
    }
});

// --- 5. RESET PASSWORD ---
router.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await User.findOneAndUpdate(
            { email: email }, 
            { 
                password: hashedPassword, 
                resetOtp: null, 
                resetOtpExpires: null 
            }
        );
        return res.status(200).json({ message: "Success" });
    } catch (err) {
        return res.status(500).json({ message: "Error" });
    }
});

// --- 6. ADMIN ROUTES ---

/**
 * ✅ FIXED: Removed the status filter.
 * This route now returns ALL residents (pending, active, rejected).
 */
router.get('/all-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ role: 'resident' })
            .select('name _id email mobileNumber role blockLot blocklot status proofOfResidencyPath');
        res.json(users);
    } catch (err) {
        console.error("All Users Fetch Error:", err);
        res.status(500).json({ message: "Error fetching residents" });
    }
});

router.get('/pending-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ role: 'resident', status: 'pending' }).sort({ createdAt: -1 });
        return res.status(200).json(users);
    } catch (err) {
        return res.status(500).json({ message: "Error fetching users" });
    }
});

/**
 * ✅ UPDATED: Update Resident Profile
 * Includes a fail-safe for the Audit Log to prevent 500 errors if adminName is missing.
 */
router.put('/update-profile/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const user = await User.findByIdAndUpdate(id, updateData, { new: true });

        if (!user) {
            return res.status(404).json({ message: "Resident not found" });
        }

        // Log the action to the Audit trail with fail-safe for adminName
        await Audit.create({
            adminName: (req.user && req.user.name) ? req.user.name : "SYSTEM ADMIN",
            action: "UPDATE RESIDENT INFO",
            details: `Updated info for ${user.name} (${user.email})`
        });

        return res.status(200).json({ message: "Resident updated successfully", user });
    } catch (err) {
        console.error("Update Profile Error:", err);
        // Include the specific error message to help with debugging
        return res.status(500).json({ message: "Error updating resident info", error: err.message });
    }
});

router.put('/update-status/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { status } = req.body; 
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            { status: status.toLowerCase() }, 
            { new: true }
        );

        if (user) {
            await Audit.create({
                adminName: (req.user && req.user.name) ? req.user.name : "SYSTEM ADMIN",
                action: `ACCOUNT ${status.toUpperCase()}`,
                details: `${status.toUpperCase()} account for ${user.name} (${user.email})`
            });
        }

        return res.status(200).json({ message: `User ${status}`, user });
    } catch (err) {
        return res.status(500).json({ message: "Error updating status" });
    }
});

module.exports = router;