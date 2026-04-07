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

        if (isAdminLogin && user.role.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ message: "Access Denied: Only Admins can enter here." });
        }

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

// --- 6. ADMIN ROUTES ---

/**
 * ✅ UPDATED: Select includes the 'type' field
 */
router.get('/all-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ role: 'resident' })
            .select('name _id email mobileNumber role blockLot blocklot status type proofOfResidencyPath');
        res.json(users);
    } catch (err) {
        console.error("All Users Fetch Error:", err);
        res.status(500).json({ message: "Error fetching residents" });
    }
});

/**
 * ✅ UPDATED: Explicitly logs type update and audit fail-safe
 */
router.put('/update-profile/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Debug Log: View incoming data in Render logs
        console.log(`Updating user ${id} with:`, updateData);

        const user = await User.findByIdAndUpdate(id, updateData, { new: true });

        if (!user) {
            return res.status(404).json({ message: "Resident not found" });
        }

        await Audit.create({
            adminName: (req.user && req.user.name) ? req.user.name : "SYSTEM ADMIN",
            action: "UPDATE RESIDENT INFO",
            details: `Updated info for ${user.name} (${user.email}). Type set to: ${user.type}`
        });

        return res.status(200).json({ message: "Resident updated successfully", user });
    } catch (err) {
        console.error("Update Profile Error:", err);
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