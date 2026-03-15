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
    // IMPORTANT: Destructure 'type' from req.body
    const { title, content, type } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const announcement = new Announcement({
      title,
      content,
      type: type || 'GENERAL', // Use the type sent from Flutter
      createdBy: req.user ? req.user._id : null
    });

    const saved = await announcement.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAll, create };