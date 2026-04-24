const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const Incident = require('../models/incidentModel');
const Audit = require('../models/auditModel');
const { protect } = require('../middleware/authMiddleware');

// ✅ CLOUDINARY CONFIG (put your credentials in .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ MULTER-CLOUDINARY STORAGE (no local disk needed)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'incidents',           // folder name in your Cloudinary account
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1024, quality: 'auto', fetch_format: 'auto' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      return `INCIDENT-${uniqueSuffix}`;
    },
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const isValid = allowed.test(file.mimetype);
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG images are allowed'));
    }
  },
});

// ─────────────────────────────────────────
// 1. GET ALL REPORTS
// ─────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    // ✅ Cloudinary already returns full HTTPS URLs — no mapping needed
    res.status(200).json(incidents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────
// 2. SUBMIT NEW REPORT
// ─────────────────────────────────────────
router.post(
  '/',
  protect,                          // ✅ Auth runs FIRST now
  upload.single('incidentPhoto'),   // ✅ Then multer
  async (req, res) => {
    try {
      // ✅ req.user is now guaranteed available from protect middleware
      const userId = req.body.userId || req.user._id;
      const userName = req.body.userName || req.user.name || 'Resident';

      if (!userId) {
        return res.status(400).json({ error: 'userId is required to file a report.' });
      }

      // ✅ Validate required fields
      if (!req.body.category || !req.body.description || !req.body.location) {
        return res.status(400).json({ error: 'Category, description, and location are required.' });
      }

      // ✅ req.file.path from Cloudinary is already a full HTTPS URL
      const incidentPhotoUrl = req.file ? req.file.path : '';

      const newIncident = await Incident.create({
        userId,
        userName,
        category: req.body.category,
        description: req.body.description,
        location: req.body.location,
        incidentPhoto: incidentPhotoUrl,
        status: 'pending',
      });

      res.status(201).json(newIncident);
    } catch (err) {
      console.error('❌ Incident Error:', err.message);
      res.status(400).json({ error: err.message });
    }
  }
);

// ─────────────────────────────────────────
// 3. UPDATE STATUS
// ─────────────────────────────────────────
router.patch('/:id', protect, async (req, res) => {
  try {
    const updated = await Incident.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status.toLowerCase() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    const resolvedStatuses = ['resolved', 'done'];
    if (resolvedStatuses.includes(req.body.status.toLowerCase())) {
      const finalAdminName = req.user?.name ?? 'SYSTEM ADMIN';
      await Audit.create({
        adminName: finalAdminName,
        action: 'INCIDENT RESOLVED',
        details: `Incident (${updated.category}) at ${updated.location} marked as resolved.`,
      });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('❌ Patch Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;