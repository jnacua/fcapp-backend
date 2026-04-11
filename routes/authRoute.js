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
        const { email, password, mobileNumber, blockLot, name, status, type } = req.body;

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
            status: status || 'pending',
            type: type || 'OWNER', 
            proofOfResidencyPath: req.file ? req.file.path.replace(/\\/g, "/") : null 
        });

        await newUser.save();

        if (status === 'active') {
            await Audit.create({
                adminName: "ADMIN", 
                action: "MANUAL RESIDENT ADD",
                details: `Admin manually added active resident: ${name} (${email})`
            });
        }

        return res.status(200).json({ message: "Success", user: newUser });
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

        if (user.role === 'resident' || user.role === 'officer') {
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
                blockLot: user.blockLot || 'N/A',
                profileImage: user.profileImage || null
            } 
        });

    } catch (err) {
        return res.status(500).json({ message: "Login error" });
    }
});

// --- 3. FORGOT/RESET PASSWORD ---
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

// --- 4. ADMIN & PROFILE UPDATES ---

router.get('/all-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ role: { $in: ['resident', 'officer'] } })
            .select('name _id email mobileNumber role blockLot status type proofOfResidencyPath');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching residents" });
    }
});

// ✅ UPDATED: Fixed for Owner/Tenant sync issue
router.patch('/update-resident/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { name, blockLot, role, mobileNumber, email, type } = req.body;

        const updateData = {
            name,
            blockLot,
            mobileNumber,
            email,
            // Force Uppercase for 'type' to match Flutter Dropdown & force Lowercase for 'role'
            type: type ? type.toUpperCase() : undefined,
            role: role ? role.toLowerCase() : undefined
        };

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!user) return res.status(404).json({ message: "Resident not found" });

        await Audit.create({
            adminName: req.user.name || "ADMIN",
            action: "UPDATE RESIDENT INFO",
            details: `Updated info for ${user.name} (${user.email}). Type: ${user.type}`
        });

        res.status(200).json({ message: "Resident updated successfully", user });
    } catch (err) {
        console.error("Update Error:", err.message);
        res.status(400).json({ error: err.message });
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
        return res.status(200).json({ message: `User ${status}`, user });
    } catch (err) {
        return res.status(500).json({ message: "Error updating status" });
    }
});

module.exports = router;