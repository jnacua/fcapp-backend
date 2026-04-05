const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Incident = require('../models/incidentModel'); 
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ✅ AUTOMATIC FOLDER CREATION (For Incident Photos)
const uploadDir = 'uploads/incidents/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `INCIDENT-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// 1. GET ALL REPORTS (Admin Side)
router.get('/', protect, async (req, res) => { 
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 });
        res.status(200).json(incidents);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. SUBMIT NEW REPORT (Mobile Side)
// ✅ Added this route - it was missing!
router.post('/', upload.single('incidentPhoto'), protect, async (req, res) => {
    try {
        console.log("--- NEW INCIDENT REPORT ---");
        console.log("Fields:", req.body);

        // Fallback logic for userId and userName
        const userId = req.body.userId || (req.user ? req.user._id : null);
        const userName = req.body.userName || (req.user ? req.user.name : "Resident");

        if (!userId) {
            return res.status(400).json({ error: "userId is required to file a report." });
        }

        const newIncident = await Incident.create({
            userId: userId,
            userName: userName,
            category: req.body.category,
            description: req.body.description,
            location: req.body.location,
            incidentPhoto: req.file ? req.file.path.replace(/\\/g, "/") : "",
            status: 'Pending'
        });

        console.log("✅ Incident Saved:", newIncident._id);
        res.status(201).json(newIncident);
    } catch (err) {
        console.error("❌ Incident Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

// 3. UPDATE STATUS (Reviewing/Resolved)
router.patch('/:id', protect, async (req, res) => {
    try {
        const updated = await Incident.findByIdAndUpdate(
            req.params.id, 
            { status: req.body.status }, 
            { new: true }
        );
        res.status(200).json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;