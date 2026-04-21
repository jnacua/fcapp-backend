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

// ✅ 2. GET ACTIVE ALERTS (For Security Dashboard and Polling)
router.get('/active', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const activeAlerts = await PanicAlert.find({ status: 'Pending' })
            .sort({ createdAt: -1 });
        
        console.log(`📡 Sending ${activeAlerts.length} active alerts`);
        res.status(200).json(activeAlerts);
    } catch (err) {
        console.error("Active alerts error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 3. GET LATEST ACTIVE ALERT (For Security Dashboard Fallback)
router.get('/latest', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        // Finds the most recent unresolved alert
        const latestPanic = await PanicAlert.findOne({ status: 'Pending' }).sort({ createdAt: -1 });
        res.status(200).json(latestPanic || null);
    } catch (error) {
        console.error("Latest Panic Error:", error);
        res.status(500).json({ error: "Failed to fetch latest alert" });
    }
});

// ✅ 4. SEND PANIC ALERT (Resident)
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
            // Prepare the alert data
            const alertData = {
                id: newAlert._id,
                name: residentName,
                blockLot: houseNo,
                latitude: latitude,
                longitude: longitude,
                status: 'Pending',
                timestamp: newAlert.createdAt
            };

            // 1. EMIT for Admin Dashboard (list view)
            io.emit('new-panic-alert', alertData);

            // 2. EMIT for Security Guard POP-UP (emergency alert)
            io.emit('emergency-alert', {
                id: newAlert._id,
                name: residentName,
                blockLot: houseNo,
                latitude: latitude,
                longitude: longitude,
                status: 'ACTIVE',
                timestamp: newAlert.createdAt
            });

            console.log(`🚨 Emergency Alert Broadcasted to ${io.engine.clientsCount} clients!`);
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

// ✅ 5. RESOLVE PANIC ALERT (Admin & Security)
router.patch('/resolve/:id', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const updatedAlert = await PanicAlert.findByIdAndUpdate(
            req.params.id, 
            { status: 'Resolved' }, 
            { new: true }
        );

        if (!updatedAlert) {
            return res.status(404).json({ error: "Panic alert not found" });
        }

        const io = req.app.get('socketio');
        if (io) {
            // Tell all clients that this panic was resolved
            io.emit('panic-resolved', { 
                id: req.params.id,
                status: 'Resolved'
            });
            
            console.log(`✅ Panic ${req.params.id} resolved and broadcasted`);
        }

        res.status(200).json(updatedAlert);
    } catch (err) {
        console.error("Resolve panic error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 6. GET SINGLE PANIC ALERT
router.get('/:id', auth.protect, async (req, res) => {
    try {
        const alert = await PanicAlert.findById(req.params.id);
        if (!alert) {
            return res.status(404).json({ error: "Alert not found" });
        }
        res.status(200).json(alert);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;