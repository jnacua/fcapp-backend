const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken'); 

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
            role: 'resident', // Default role for mobile users
            status: 'pending', 
            proofOfResidencyPath: req.file ? req.file.path : null
        });

        await newUser.save();
        return res.status(200).json({ message: "Success" });
    } catch (err) {
        return res.status(500).json({ message: "Registration failed", error: err.message });
    }
});

// --- 2. LOGIN (SECURED FOR ADMIN & RESIDENTS) ---
router.post('/login', async (req, res) => {
    try {
        const { email, password, isAdminLogin } = req.body; 

        // 🔥 DEBUG LOG: This will show in your Node terminal exactly what Flutter sent
        console.log("-----------------------------------------");
        console.log(`🔍 LOGIN ATTEMPT: [${email}]`);
        console.log(`🔑 Admin Login Requested: ${isAdminLogin}`);

        // Find user by email
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log("❌ Result: User not found in database");
            return res.status(404).json({ message: "User not found" });
        }

        console.log(`✅ Result: User found! Role: ${user.role}, Status: ${user.status}`);

        // --- ADMIN SECURITY CHECK ---
        // If request is from Web Admin Panel, but user is not ADMIN
        if (isAdminLogin && user.role !== 'ADMIN') {
            console.log("🚫 Result: Access denied. User is not an ADMIN");
            return res.status(403).json({ message: "Access Denied: Only Admins can enter here." });
        }

        // Resident-specific checks (Mobile App)
        if (user.role === 'resident') {
            if (user.status === 'pending') {
                return res.status(403).json({ message: "Wait for admin approval" });
            }
            if (user.status === 'rejected' || user.status === 'ARCHIVED') {
                return res.status(403).json({ message: "Account inactive. Contact admin." });
            }
        }

        // Password Check
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log("❌ Result: Invalid password");
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET || 'lebronjames23', 
            { expiresIn: '30d' }
        );

        console.log("🎉 Result: Login Successful!");
        return res.status(200).json({ 
            message: "Login successful", 
            token: token, 
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            } 
        });

    } catch (err) {
        console.error("💥 Login Error:", err);
        return res.status(500).json({ message: "Login error" });
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
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #66BB8A; border-radius: 10px;">
                    <h2 style="color: #66BB8A;">Password Reset</h2>
                    <p>Your 6-digit OTP code is:</p>
                    <h1 style="color: #333; letter-spacing: 5px;">${otp}</h1>
                    <p>This code expires in 10 minutes. Do not share this code with anyone.</p>
                </div>
            `
        };

        await req.transporter.sendMail(mailOptions);
        console.log(`🔑 OTP sent to ${email}: ${otp}`);
        
        return res.status(200).json({ message: "OTP sent" });
    } catch (err) { 
        console.error(err);
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
router.get('/pending-users', async (req, res) => {
    try {
        const users = await User.find({ status: 'pending' });
        return res.status(200).json(users);
    } catch (err) {
        return res.status(500).json({ message: "Error fetching users" });
    }
});

router.put('/update-status/:id', async (req, res) => {
    try {
        const { status } = req.body; 
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            { status: status }, 
            { new: true }
        );
        return res.status(200).json({ message: `User ${status}`, user });
    } catch (err) {
        return res.status(500).json({ message: "Error updating status" });
    }
});

module.exports = router;