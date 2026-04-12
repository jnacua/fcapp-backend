const express = require('express');
const router = express.Router();
const PanicAlert = require('../models/panicModel');
const auth = require('../middleware/authMiddleware');

// --- 1. SEND PANIC ALERT (Resident) ---
router.post('/send', auth.protect, async (req, res) => {
    try {
        const { latitude, longitude, residentName, houseNo } = req.body;

        // Save to Database
        const newAlert = new PanicAlert({
            userId: req.user.id,
            residentName,
            houseNo,
            location: { latitude, longitude },
            status: 'Pending'
        });

        await newAlert.save();

        // 🚨 EMIT REAL-TIME ALERT TO ADMIN 🚨
        const io = req.app.get('socketio');
        if (io) {
            io.emit('new-panic-alert', {
                _id: newAlert._id,
                userName: residentName,
                blockLot: houseNo,
                latitude: latitude,
                longitude: longitude,
                status: 'Pending'
            });
        }

        res.status(201).json({ 
            message: "Alert sent successfully and broadcasted to Admin", 
            alert: newAlert 
        });
        
    } catch (err) {
        console.error("Panic Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 2. GET MY ALERTS (Resident History) ---
// ✅ FIX: Added this route to match Flutter's call to /panic/my-alerts
router.get('/my-alerts', auth.protect, async (req, res) => {
    try {
        const alerts = await PanicAlert.find({ userId: req.user.id })
            .sort({ createdAt: -1 }); // Sort newest to oldest
        res.status(200).json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. RESOLVE PANIC ALERT (Admin) ---
router.patch('/resolve/:id', auth.protect, auth.restrictTo('ADMIN'), async (req, res) => {
    try {
        const updatedAlert = await PanicAlert.findByIdAndUpdate(
            req.params.id, 
            { status: 'Resolved' }, 
            { new: true }
        );
        res.status(200).json(updatedAlert);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;