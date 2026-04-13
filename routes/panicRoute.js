const express = require('express');
const router = express.Router();
const PanicAlert = require('../models/panicModel');
const auth = require('../middleware/authMiddleware');

// ✅ 1. GET ALERTS (Global for Admin & Security, Personal for Residents)
router.get('/my-alerts', auth.protect, async (req, res) => {
    try {
        let query = {};
        
        // Normalize the role to Uppercase for a safe check
        const userRole = req.user.role ? req.user.role.toUpperCase() : '';

        // ✅ UPDATED: If the user is NOT an Admin AND NOT Security, filter by their userId.
        // This allows both ADMIN and SECURITY roles to see ALL community records.
        if (userRole !== 'ADMIN' && userRole !== 'SECURITY') {
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

// ✅ 2. GET LATEST ACTIVE ALERT (For Security Dashboard Fallback)
router.get('/latest', async (req, res) => {
    try {
        // Finds the most recent unresolved alert
        const latestPanic = await PanicAlert.findOne({ status: 'Pending' }).sort({ createdAt: -1 });
        res.status(200).json(latestPanic || null);
    } catch (error) {
        console.error("Latest Panic Error:", error);
        res.status(500).json({ error: "Failed to fetch latest alert" });
    }
});

// ✅ 3. SEND PANIC ALERT (Resident)
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
            // 1. THIS EMIT KEEPS YOUR ADMIN SIDE WORKING
            io.emit('new-panic-alert', {
                _id: newAlert._id,
                userName: residentName,
                blockLot: houseNo,
                latitude: latitude,
                longitude: longitude,
                status: 'Pending'
            });

            // 2. ✅ THIS EMIT TRIGGERS THE SECURITY GUARD POP-UP
            io.emit('emergency-alert', {
                name: residentName,
                blockLot: houseNo,
                status: 'ACTIVE'
            });

            console.log("🚨 Emergency Alert Broadcasted to Admin and Security!");
        }

        res.status(201).json({ 
            message: "Alert sent successfully and broadcasted to Admin & Security", 
            alert: newAlert 
        });
        
    } catch (err) {
        console.error("Panic Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 4. RESOLVE PANIC ALERT (Admin & Security)
// ✅ UPDATED: Added 'SECURITY' to restrictTo so guards can actually click the resolve button.
router.patch('/resolve/:id', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const updatedAlert = await PanicAlert.findByIdAndUpdate(
            req.params.id, 
            { status: 'Resolved' }, 
            { new: true }
        );

        const io = req.app.get('socketio');
        if (io) {
            // ✅ Tells the Security Dashboard to close the red pop-up
            io.emit('panic-resolved', { _id: req.params.id }); 
        }

        res.status(200).json(updatedAlert);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;