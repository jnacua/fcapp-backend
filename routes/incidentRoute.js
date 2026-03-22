const express = require('express');
const router = express.Router();
const Incident = require('../models/incidentModel'); // ✅ Matches your actual filename

// This matches: GET https://fcapp-backend.onrender.com/api/incidents
router.get('/', async (req, res) => { 
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 });
        res.status(200).json(incidents);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// This matches: PATCH https://fcapp-backend.onrender.com/api/incidents/:id
router.patch('/:id', async (req, res) => {
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