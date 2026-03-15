const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Incident = require('../models/incidentModel'); 
const { protect, restrictTo } = require('../middleware/authMiddleware'); // Added restrictTo

// --- CONFIGURE STORAGE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/incidents/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- 1. RESIDENT: CREATE INCIDENT ---
router.post('/', protect, upload.single('incidentPhoto'), async (req, res) => {
    try {
        const { category, description, location } = req.body; 
        
        const newIncident = await Incident.create({
            user: req.user.id, 
            category,
            description,
            location,
            image: req.file ? req.file.path : null,
            status: 'pending'
        });

        res.status(201).json({
            status: 'success',
            message: 'Incident reported successfully',
            data: newIncident
        });
    } catch (err) {
        console.error("Incident Route Error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// --- 2. ADMIN/SECURITY: VIEW ALL REPORTS ---
// This is the "Admin Side" dashboard. It populates user info so you know who reported it.
router.get('/admin/all', protect, restrictTo('admin', 'security'), async (req, res) => {
    try {
        const incidents = await Incident.find()
            .populate('user', 'name mobileNumber blockLot email') // Shows reporter details
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            results: incidents.length,
            data: incidents
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching incidents', error: err.message });
    }
});

// --- 3. ADMIN/SECURITY: UPDATE STATUS ---
// This allows Admin to change status from 'pending' to 'resolved'
router.patch('/:id/status', protect, restrictTo('admin', 'security'), async (req, res) => {
    try {
        const updatedIncident = await Incident.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true, runValidators: true }
        );

        if (!updatedIncident) {
            return res.status(404).json({ message: 'No incident found with that ID' });
        }

        res.status(200).json({
            status: 'success',
            data: updatedIncident
        });
    } catch (err) {
        res.status(400).json({ message: 'Error updating status', error: err.message });
    }
});

module.exports = router;