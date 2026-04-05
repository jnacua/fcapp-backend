const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const Audit = require('../models/auditModel'); // ✅ ADDED: To track approvals
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken'); 
const { protect, restrictTo } = require('../middleware/authMiddleware'); // ✅ ADDED: Security

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
            proofOfResidencyPath: req.file ? req.file.path.replace(/\\/g, "/") : null // ✅ FIXED: Path slashes
        });

        await newUser.save();
        return res.status(200).json({ message: "Success" });
    } catch (err) {
        return res.status(500).json({ message: "Registration failed", error: err.message });
    }
});

// --- 2. LOGIN (Already looks good) ---
router.post('/login', async (req, res) => {
    try {
        const { email, password, isAdminLogin } = req.body; 

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (isAdminLogin && user.role !== 'ADMIN') {
            return res.status(403).json({ message: "Access Denied: Only Admins can enter here." });
        }

        if (user.role === 'resident') {
            if (user.status === 'pending') {
                return res.status(403).json({ message: "Wait for admin approval" });
            }
            if (user.status === 'rejected' || user.status === 'ARCHIVED') {
                return res.status(403).json({ message: "Account inactive. Contact admin." });
            }
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET || 'lebronjames23', 
            { expiresIn: '30d' }
        );

        return res.status(200).json({ 
            message: "Login successful", 
            token: token, 
            user: { id: user._id, name: user.name, email: user.email, role: user.role } 
        });

    } catch (err) {
        return res.status(500).json({ message: "Login error" });
    }
});

// --- 3, 4, 5. FORGOT PASSWORD / OTP / RESET (Keep your existing code here) ---
// ... (omitted for brevity)

// --- 6. ADMIN ROUTES (ENHANCED) ---

// ✅ GET all users for the Account Approval screen
router.get('/all-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        // Fetching all residents so the admin can see current and pending
        const users = await User.find({ role: 'resident' }).sort({ createdAt: -1 });
        return res.status(200).json(users);
    } catch (err) {
        return res.status(500).json({ message: "Error fetching users" });
    }
});

// ✅ GET only pending users
router.get('/pending-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ status: 'pending' });
        return res.status(200).json(users);
    } catch (err) {
        return res.status(500).json({ message: "Error fetching users" });
    }
});

// ✅ UPDATE status with Audit Trail logging
router.put('/update-status/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { status } = req.body; 
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            { status: status }, 
            { new: true }
        );

        if (user) {
            // ✅ Log the approval/rejection to the Audit Trail
            await Audit.create({
                adminName: req.user ? req.user.name : "ADMIN",
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