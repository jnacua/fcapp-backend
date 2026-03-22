const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Announcement = require('../models/announcementModel');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ==========================================
// 0. CLOUDINARY & MULTER CONFIGURATION
// ==========================================
// This uses the environment variables you added to Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'announcements', // Images will be organized in this folder on Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 1200, crop: 'limit' }] // Optional: resizes large images
  },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ==========================================
// 1. ADMIN ONLY: Post a new announcement
// ==========================================
router.post('/', protect, restrictTo('ADMIN'), upload.single('file'), async (req, res) => {
    try {
        const { title, content, type, date, status } = req.body;

        const announcementData = {
            title,
            content,
            type: type || 'GENERAL',
            status: status || "PUBLISHED",
            createdBy: req.user.id,
            date: date || Date.now(),
            // ✅ req.file.path is now the full HTTPS URL from Cloudinary
            file: req.file ? req.file.path : null, 
        };

        const announcement = await Announcement.create(announcementData);
        res.status(201).json(announcement);
    } catch (err) {
        console.error("❌ Error creating announcement:", err);
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// 2. PUBLIC/RESIDENT: Get all announcements
// ==========================================
router.get('/', protect, async (req, res) => {
    try {
        const announcements = await Announcement.find({ 
            status: { $ne: 'ARCHIVED' } 
        }).sort({ isPinned: -1, date: -1 });
        
        res.status(200).json(announcements);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 3. ADMIN ONLY: Update an existing announcement
// ==========================================
router.patch('/:id', protect, restrictTo('ADMIN'), upload.single('file'), async (req, res) => {
    try {
        let updateData = { ...req.body };

        // ✅ If a new file is uploaded, update the Cloudinary URL
        if (req.file) {
            updateData.file = req.file.path;
        }

        const updatedAnnouncement = await Announcement.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        );

        if (!updatedAnnouncement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        res.status(200).json(updatedAnnouncement);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// 4. ADMIN ONLY: Quick Status Toggle (Pin/Archive)
// ==========================================
router.patch('/status/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { status, isPinned } = req.body;
        const announcement = await Announcement.findByIdAndUpdate(
            req.params.id,
            { status, isPinned },
            { new: true }
        );
        res.status(200).json(announcement);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// 5. ADMIN ONLY: Delete an announcement
// ==========================================
router.delete('/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const deleted = await Announcement.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Announcement not found' });
        }
        res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;