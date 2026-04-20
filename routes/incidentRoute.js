const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Incident = require('../models/incidentModel'); 
const Audit = require('../models/auditModel'); 
const { protect } = require('../middleware/authMiddleware');

// ✅ AUTOMATIC FOLDER CREATION
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

// 1. GET ALL REPORTS
router.get('/', protect, async (req, res) => { 
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 });
        
        // ✅ MAP PATHS TO FULL URLS
        // This ensures the frontend gets a clickable link, not just a folder path
        const host = req.get('host');
        const protocol = req.protocol;
        
        const formattedIncidents = incidents.map(incident => {
            const obj = incident.toObject();
            if (obj.incidentPhoto && !obj.incidentPhoto.startsWith('http')) {
                obj.incidentPhoto = `${protocol}://${host}/${obj.incidentPhoto}`;
            }
            return obj;
        });

        res.status(200).json(formattedIncidents); 
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. SUBMIT NEW REPORT (Mobile)
router.post('/', upload.single('incidentPhoto'), protect, async (req, res) => {
    try {
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
            // ✅ Store the path with forward slashes for URL compatibility
            incidentPhoto: req.file ? req.file.path.replace(/\\/g, "/") : "", 
            status: 'pending' 
        });

        res.status(201).json(newIncident);
    } catch (err) {
        console.error("❌ Incident Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

// 3. UPDATE STATUS
router.patch('/:id', protect, async (req, res) => {
    try {
        const updated = await Incident.findByIdAndUpdate(
            req.params.id, 
            { status: req.body.status.toLowerCase() }, 
            { new: true }
        );

        if (updated && (req.body.status.toLowerCase() === 'resolved' || req.body.status.toLowerCase() === 'done')) {
            const finalAdminName = (req.user && req.user.name) ? req.user.name : "SYSTEM ADMIN";

            await Audit.create({
                adminName: finalAdminName,
                action: "INCIDENT RESOLVED",
                details: `Incident (${updated.category}) at ${updated.location} marked as resolved.`
            });
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error("❌ Patch Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;