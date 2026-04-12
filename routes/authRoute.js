const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const Audit = require('../models/auditModel'); 
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const jwt = require('jsonwebtoken'); 
const { protect, restrictTo } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController'); // ✅ Import controller for profile picture logic

// ==========================================
// 0. CLOUDINARY CONFIGURATION
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage Engine for Registration Proofs (ID/Bills)
const residencyStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'residency_proofs', 
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 1000, crop: 'limit' }] 
    },
});

// ✅ Storage Engine for User Profile Pictures (Circular Avatars)
const profilePicStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'profile_pictures', 
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' } // Automatically finds and centers the face
        ] 
    },
});

const uploadProof = multer({ storage: residencyStorage });
const uploadProfile = multer({ storage: profilePicStorage });

// --- 1. REGISTRATION ---
router.post('/register', uploadProof.single('proofImage'), async (req, res) => {
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
            proofOfResidencyPath: req.file ? req.file.path : null 
        });

        await newUser.save();

        if (status === 'active') {
            await Audit.create({
                adminName: "ADMIN", 
                action: "MANUAL RESIDENT ADD",
                details: `Admin manually added active resident: ${name} (${email})`
            });
        }

        console.log("✅ User Registered. Proof URL:", newUser.proofOfResidencyPath);
        return res.status(200).json({ message: "Success", user: newUser });
    } catch (err) {
        console.error("❌ Registration Error:", err.message);
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

        // Security check for Admin Portal access
        if (isAdminLogin && user.role.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ message: "Access Denied: Only Admins can enter here." });
        }

        // Status checks for Residents/Officers
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

// --- 3. PROFILE PICTURE UPLOAD ---
// ✅ This endpoint is hit by the Flutter ProfileScreen
router.post(
    '/update-profile-picture', 
    protect, 
    uploadProfile.single('profileImage'), 
    authController.updateProfilePicture
);

// --- 4. ADMIN ROUTES ---

// Fetch all pending applications
router.get('/pending-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ status: 'pending' });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching pending users" });
    }
});

// Fetch all residents and officers
router.get('/all-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ role: { $in: ['resident', 'officer'] } })
            .select('name _id email mobileNumber role blockLot status type proofOfResidencyPath');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching residents" });
    }
});

// Update specific resident information
router.patch('/update-resident/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { name, blockLot, role, mobileNumber, email, type } = req.body;
        const updateData = {
            name,
            blockLot,
            mobileNumber,
            email,
            type: type ? type.toUpperCase() : undefined,
            role: role ? role.toLowerCase() : undefined
        };

        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!user) return res.status(404).json({ message: "Resident not found" });

        res.status(200).json({ message: "Resident updated successfully", user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin action: Approve/Reject/Archive status
router.put('/update-status/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { status } = req.body; 
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            { status: status.toLowerCase() }, 
            { new: true }
        );
        return res.status(200).json({ message: `User status updated to ${status}`, user });
    } catch (err) {
        return res.status(500).json({ message: "Error updating status" });
    }
});

module.exports = router;    