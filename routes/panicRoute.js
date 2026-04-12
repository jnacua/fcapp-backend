const express = require('express');
const router = express.Router();
const PanicAlert = require('../models/panicModel');
const auth = require('../middleware/authMiddleware');

// ✅ 1. GET ALERTS (Global for Admin, Personal for Residents)
// This MUST be above any route with /:id to prevent 404 errors
router.get('/my-alerts', auth.protect, async (req, res) => {
    try {
        let query = {};

        // ✅ FIX: If the user is NOT an admin, only show their own alerts.
        // If they ARE an admin, the query stays empty {}, fetching ALL records.
        if (req.user.role !== 'ADMIN') {
            query = { userId: req.user.id };
        }

        const alerts = await PanicAlert.find(query)
            .sort({ createdAt: -1 });

        console.log(`📡 Sending ${alerts.length} alerts to role: ${req.user.role}`);
        res.status(200).json(alerts);
    } catch (err) {
        console.error("Error fetching alerts:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 2. SEND PANIC ALERT (Resident)
router.post('/send', auth.protect, async (req, res) => {
    try {
        const { latitude, longitude, residentName, houseNo } = req.body;

        const newAlert = new PanicAlert({
            userId: req.user.id,
            residentName,
            houseNo,
            location: { latitude, longitude },
            status: 'Pending'
        });

        await newAlert.save();

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

// ✅ 3. RESOLVE PANIC ALERT (Admin)
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