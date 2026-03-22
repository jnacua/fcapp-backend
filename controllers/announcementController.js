const Announcement = require('../models/announcementModel');

// GET all announcements
const getAll = async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// CREATE a new announcement
const create = async (req, res) => {
  try {
    const { title, content, type } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    // ✅ 1. CAPTURE THE FILE PATH FROM MULTER
    // If a file was uploaded, req.file will contain the information
    let imagePath = null;
    if (req.file) {
      // We save the path (e.g., "uploads/171012345.png") to the database
      imagePath = req.file.path; 
    }

    const announcement = new Announcement({
      title,
      content,
      type: type || 'GENERAL',
      // ✅ 2. SAVE THE PATH TO THE DATABASE FIELD
      // Ensure your announcementModel.js has a field named 'file' or 'image'
      file: imagePath, 
      createdBy: req.user ? req.user._id : null
    });

    const saved = await announcement.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Controller Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAll, create };