const express = require('express');
const router = express.Router();
const multer = require('multer'); // Import multer
const Announcement = require('../models/announcementModel');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ==========================================
// 0. MULTER CONFIGURATION
// ==========================================
// This saves files to your 'uploads' folder and keeps the original name
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 1. ADMIN ONLY: Post a new announcement
// ==========================================
// ADDED: upload.single('file') middleware here
router.post('/', protect, restrictTo('ADMIN'), upload.single('file'), async (req, res) => {
    try {
        // After multer processes the request, fields like title, content, 
        // and date are now available in req.body
        const { title, content, type, date, status } = req.body;

        const announcementData = {
            title,
            content,
            type,
            status: status || "PUBLISHED",
            createdBy: req.user.id,
            date: date || Date.now(),
        };

        // If a file was uploaded, add the path to the database
        if (req.file) {
            announcementData.attachmentUrl = `/uploads/${req.file.filename}`;
            // Note: Ensure 'attachmentUrl' or similar field exists in your announcementModel.js
        }

        const announcement = await Announcement.create(announcementData);
        
        res.status(201).json(announcement);
    } catch (err) {
        console.error("Error creating announcement:", err);
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

        if (req.file) {
            updateData.attachmentUrl = `/uploads/${req.file.filename}`;
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