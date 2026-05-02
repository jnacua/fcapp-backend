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

// Import controller for profile picture and password logic
const authController = require('../controllers/authController'); 

// STARTUP DEBUGGING
console.log("--- 🛠️ SERVER BOOT: Checking authController ---");
if (authController && authController.updateProfilePicture) {
    console.log("✅ DEBUG: authController.updateProfilePicture is ready!");
} else {
    console.log("❌ DEBUG: authController.updateProfilePicture is UNDEFINED. Check your exports!");
}

// ==========================================
// 0. CLOUDINARY CONFIGURATION
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const residencyStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'residency_proofs', 
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 1000, crop: 'limit' }] 
    },
});

const profilePicStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'profile_pictures', 
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' }
        ] 
    },
});

const uploadProof = multer({ storage: residencyStorage });
const uploadProfile = multer({ storage: profilePicStorage });

// ==========================================
// 1. REGISTRATION & LOGIN
// ==========================================

router.post('/register', async (req, res) => {
    try {
        const isMultipart = req.is('multipart/form-data');
        let requestData;
        
        if (isMultipart) {
            await new Promise((resolve, reject) => {
                uploadProof.single('proofImage')(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            requestData = req.body;
        } else {
            requestData = req.body;
        }
        
        const { 
            email, 
            password, 
            mobileNumber, 
            blockLot, 
            name, 
            status, 
            type,
            originalOwnerName,
            originalOwnerContact,
            originalOwnerEmail,
            role
        } = requestData;

        console.log("📝 Registration request:", { email, name, type, originalOwnerName });

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password || 'Password123!', salt);

        const userData = {
            email: email.toLowerCase(),
            password: hashedPassword,
            mobileNumber: mobileNumber || '',
            blockLot: blockLot || '',
            name: name || '',
            role: role || 'resident', 
            status: status || 'pending',
            type: type ? type.toUpperCase() : 'OWNER',
            proofOfResidencyPath: isMultipart && req.file ? req.file.path : null
        };

        // Add original owner fields for TENANT
        if (userData.type === 'TENANT') {
            userData.originalOwnerName = originalOwnerName || '';
            userData.originalOwnerContact = originalOwnerContact || '';
            userData.originalOwnerEmail = originalOwnerEmail ? originalOwnerEmail.toLowerCase() : '';
            userData.displayName = `${name} (Tenant of ${originalOwnerName || 'Unknown'})`;
        } else {
            userData.displayName = name || '';
        }

        const newUser = new User(userData);
        await newUser.save();

        if (status === 'active') {
            await Audit.create({
                adminName: "ADMIN", 
                action: "MANUAL RESIDENT ADD",
                details: `Admin manually added active resident: ${name} (${email})`
            });
        }

        console.log(`✅ User Registered: ${newUser.email} (${newUser.type})`);
        
        const token = jwt.sign(
            { id: newUser._id, role: newUser.role }, 
            process.env.JWT_SECRET || 'lebronjames23', 
            { expiresIn: '30d' }
        );

        return res.status(200).json({ 
            message: "Success", 
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                type: newUser.type,
                status: newUser.status,
                blockLot: newUser.blockLot,
                mobileNumber: newUser.mobileNumber,
                originalOwnerName: newUser.originalOwnerName,
                originalOwnerContact: newUser.originalOwnerContact,
                originalOwnerEmail: newUser.originalOwnerEmail,
                displayName: newUser.displayName
            },
            token 
        });
    } catch (err) {
        console.error("❌ Registration Error:", err.message);
        console.error("Stack:", err.stack);
        return res.status(500).json({ message: "Registration failed", error: err.message });
    }
});

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
            // ✅ FIXED: Removed the extra parenthesis
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
                type: user.type,
                blockLot: user.blockLot || 'N/A',
                profileImage: user.profileImage || null,
                mobileNumber: user.mobileNumber,
                originalOwnerName: user.originalOwnerName,
                originalOwnerContact: user.originalOwnerContact,
                originalOwnerEmail: user.originalOwnerEmail,
                displayName: user.displayName
            } 
        });

    } catch (err) {
        console.error("❌ Login error:", err);
        return res.status(500).json({ message: "Login error" });
    }
});

router.get('/me', protect, authController.getMe);

// ==========================================
// 2. FORGOT PASSWORD FLOW
// ==========================================

router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);

// ==========================================
// 3. PROFILE PICTURE UPLOAD
// ==========================================

router.post(
    '/update-profile-picture', 
    protect, 
    uploadProfile.single('profileImage'), 
    authController.updateProfilePicture
);

// ==========================================
// 4. ADMIN ROUTES
// ==========================================

router.get('/pending-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ status: 'pending' });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching pending users" });
    }
});

router.get('/all-users', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const users = await User.find({ role: { $in: ['resident', 'officer'] } })
            .select('name _id email mobileNumber role blockLot status type proofOfResidencyPath originalOwnerName originalOwnerContact originalOwnerEmail displayName');
        res.json(users);
    } catch (err) {
        console.error("❌ Error fetching residents:", err);
        res.status(500).json({ message: "Error fetching residents" });
    }
});

router.patch('/update-resident/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { name, blockLot, role, mobileNumber, email, type, originalOwnerName, originalOwnerContact, originalOwnerEmail } = req.body;
        
        const updateData = {
            name,
            blockLot,
            mobileNumber,
            email,
            type: type ? type.toUpperCase() : undefined,
            role: role ? role.toLowerCase() : undefined
        };
        
        if (type === 'TENANT') {
            if (originalOwnerName !== undefined) updateData.originalOwnerName = originalOwnerName;
            if (originalOwnerContact !== undefined) updateData.originalOwnerContact = originalOwnerContact;
            if (originalOwnerEmail !== undefined) updateData.originalOwnerEmail = originalOwnerEmail;
            updateData.displayName = `${name} (Tenant of ${originalOwnerName || 'Unknown'})`;
        }

        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!user) return res.status(404).json({ message: "Resident not found" });

        res.status(200).json({ message: "Resident updated successfully", user });
    } catch (err) {
        console.error("❌ Update resident error:", err);
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
        return res.status(200).json({ message: `User status updated to ${status}`, user });
    } catch (err) {
        return res.status(500).json({ message: "Error updating status" });
    }
});

module.exports = router;