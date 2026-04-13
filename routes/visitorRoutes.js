const express = require('express');
const router = express.Router();
// ✅ Ensure you have a Visitor model created in your models folder
const VisitorLog = require('../models/visitorModel'); 
const auth = require('../middleware/authMiddleware');

// ✅ POST: Save a new visitor entry
router.post('/log-entry', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const { name, purpose, hostName } = req.body;

        const newLog = new VisitorLog({
            visitorName: name,
            purpose: purpose,
            residentToVisit: hostName,
            recordedBy: req.user.id, // Links the log to the Guard who scanned them
            entryTime: new Date()
        });

        await newLog.save();
        res.status(201).json({ 
            success: true, 
            message: "Visitor entry saved to database!" 
        });
    } catch (err) {
        console.error("Visitor Log Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;