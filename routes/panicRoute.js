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
            .populate('userId', 'name email blockLot')
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
            .populate('userId', 'name email blockLot')
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
        const latestPanic = await PanicAlert.findOne({ status: 'Pending' })
            .populate('userId', 'name email blockLot')
            .sort({ createdAt: -1 });
        res.status(200).json(latestPanic || null);
    } catch (error) {
        console.error("Latest Panic Error:", error);
        res.status(500).json({ error: "Failed to fetch latest alert" });
    }
});

// ✅ 4. SEND PANIC ALERT (Resident)
router.post('/send', auth.protect, async (req, res) => {
    try {
        const { latitude, longitude, residentName, houseNo, emergencyType } = req.body;

        // Validate required fields
        if (!latitude || !longitude) {
            return res.status(400).json({ error: "Latitude and longitude are required" });
        }

        const newAlert = new PanicAlert({
            userId: req.user.id,
            residentName: residentName || req.user.name,
            houseNo: houseNo || req.user.blockLot,
            location: { 
                latitude: latitude, 
                longitude: longitude 
            },
            emergencyType: emergencyType || 'Emergency Alert', // ✅ Added emergency type
            status: 'Pending'
        });

        await newAlert.save();

        // Populate user data for the response
        const populatedAlert = await PanicAlert.findById(newAlert._id)
            .populate('userId', 'name email blockLot');

        const io = req.app.get('socketio');
        if (io) {
            // Prepare the alert data with emergency type
            const alertData = {
                _id: populatedAlert._id,
                id: populatedAlert._id,
                userId: populatedAlert.userId._id,
                userName: populatedAlert.userId.name,
                name: populatedAlert.residentName,
                blockLot: populatedAlert.houseNo,
                houseNo: populatedAlert.houseNo,
                latitude: populatedAlert.location.latitude,
                longitude: populatedAlert.location.longitude,
                emergencyType: populatedAlert.emergencyType, // ✅ CRITICAL: Include this!
                status: populatedAlert.status,
                timestamp: populatedAlert.createdAt,
                createdAt: populatedAlert.createdAt
            };

            // 1. EMIT for Admin Dashboard (list view)
            io.emit('new-panic-alert', alertData);

            // 2. EMIT for Security Guard POP-UP (emergency alert)
            io.emit('emergency-alert', {
                _id: populatedAlert._id,
                id: populatedAlert._id,
                name: populatedAlert.residentName,
                userName: populatedAlert.userId.name,
                blockLot: populatedAlert.houseNo,
                houseNo: populatedAlert.houseNo,
                latitude: populatedAlert.location.latitude,
                longitude: populatedAlert.location.longitude,
                emergencyType: populatedAlert.emergencyType, // ✅ CRITICAL: Include this!
                status: 'ACTIVE',
                timestamp: populatedAlert.createdAt
            });

            console.log(`🚨 Emergency Alert Broadcasted to ${io.engine.clientsCount} clients!`);
            console.log(`📋 Emergency Type: ${populatedAlert.emergencyType}`);
        }

        res.status(201).json({ 
            message: "Alert sent successfully and broadcasted to Admin & Security", 
            alert: {
                _id: newAlert._id,
                emergencyType: newAlert.emergencyType,
                status: newAlert.status
            }
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
        ).populate('userId', 'name email blockLot');

        if (!updatedAlert) {
            return res.status(404).json({ error: "Panic alert not found" });
        }

        const io = req.app.get('socketio');
        if (io) {
            // Tell all clients that this panic was resolved
            io.emit('panic-resolved', { 
                id: req.params.id,
                _id: req.params.id,
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
        const alert = await PanicAlert.findById(req.params.id)
            .populate('userId', 'name email blockLot');
        
        if (!alert) {
            return res.status(404).json({ error: "Alert not found" });
        }
        
        // Format response to include emergency type
        const formattedAlert = {
            _id: alert._id,
            userId: alert.userId?._id,
            userName: alert.userId?.name,
            residentName: alert.residentName,
            houseNo: alert.houseNo,
            location: alert.location,
            emergencyType: alert.emergencyType, // ✅ Include this!
            status: alert.status,
            respondingUnit: alert.respondingUnit,
            createdAt: alert.createdAt,
            updatedAt: alert.updatedAt
        };
        
        res.status(200).json(formattedAlert);
    } catch (err) {
        console.error("Error fetching single alert:", err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 7. UPDATE RESPONDING UNIT (Admin & Security)
router.patch('/respond/:id', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const { respondingUnit } = req.body;
        
        const updatedAlert = await PanicAlert.findByIdAndUpdate(
            req.params.id,
            { 
                respondingUnit: respondingUnit,
                status: 'Responding'
            },
            { new: true }
        ).populate('userId', 'name email blockLot');

        if (!updatedAlert) {
            return res.status(404).json({ error: "Panic alert not found" });
        }

        const io = req.app.get('socketio');
        if (io) {
            io.emit('panic-updated', {
                id: req.params.id,
                _id: req.params.id,
                status: 'Responding',
                respondingUnit: respondingUnit,
                emergencyType: updatedAlert.emergencyType
            });
        }

        res.status(200).json(updatedAlert);
    } catch (err) {
        console.error("Error updating responding unit:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;