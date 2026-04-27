const express = require('express');
const router = express.Router();
const PanicAlert = require('../models/panicModel');
const auth = require('../middleware/authMiddleware');

// ✅ Helper function to format timestamp
function _formatTimestamp(date) {
    if (!date) return '--:-- --';
    try {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let hour = date.getHours();
        const minute = date.getMinutes().toString().padStart(2, '0');
        const period = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} - ${hour}:${minute} ${period}`;
    } catch (e) {
        return date.toString();
    }
}

// ✅ 1. GET ALERTS (Global for Admin & Security, Personal for Residents)
router.get('/my-alerts', auth.protect, async (req, res) => {
    try {
        let query = {};
        
        const userRole = req.user.role ? req.user.role.toUpperCase() : '';

        if (userRole !== 'ADMIN' && userRole !== 'SECURITY') {
            query = { userId: req.user.id };
        }

        const alerts = await PanicAlert.find(query)
            .populate('userId', 'name email blockLot mobileNumber')
            .sort({ createdAt: -1 });

        // Format alerts with proper timestamps
        const formattedAlerts = alerts.map(alert => ({
            _id: alert._id,
            id: alert._id,
            userId: alert.userId?._id,
            residentName: alert.residentName,
            userName: alert.userId?.name,
            houseNo: alert.houseNo || 'N/A',
            blockLot: alert.blockLot || alert.userId?.blockLot || 'N/A',
            location: alert.location,
            emergencyType: alert.emergencyType,
            status: alert.status,
            respondingUnit: alert.respondingUnit,
            createdAt: alert.createdAt,
            formattedTime: _formatTimestamp(alert.createdAt),
            message: alert.message || ''
        }));

        console.log(`📡 Sending ${formattedAlerts.length} alerts to role: ${req.user.role}`);
        res.status(200).json(formattedAlerts);
    } catch (err) {
        console.error("Error fetching alerts:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 2. GET ACTIVE ALERTS (For Security Dashboard and Polling)
router.get('/active', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const activeAlerts = await PanicAlert.find({ status: 'Pending' })
            .populate('userId', 'name email blockLot mobileNumber')
            .sort({ createdAt: -1 });
        
        const formattedAlerts = activeAlerts.map(alert => ({
            _id: alert._id,
            id: alert._id,
            residentName: alert.residentName,
            userName: alert.userId?.name,
            houseNo: alert.houseNo || 'N/A',
            blockLot: alert.blockLot || alert.userId?.blockLot || 'N/A',
            location: alert.location,
            emergencyType: alert.emergencyType,
            status: alert.status,
            createdAt: alert.createdAt,
            formattedTime: _formatTimestamp(alert.createdAt)
        }));
        
        console.log(`📡 Sending ${formattedAlerts.length} active alerts`);
        res.status(200).json(formattedAlerts);
    } catch (err) {
        console.error("Active alerts error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 3. GET LATEST ACTIVE ALERT (For Security Dashboard Fallback)
router.get('/latest', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const latestPanic = await PanicAlert.findOne({ status: 'Pending' })
            .populate('userId', 'name email blockLot mobileNumber')
            .sort({ createdAt: -1 });
        
        if (latestPanic) {
            const formattedAlert = {
                _id: latestPanic._id,
                id: latestPanic._id,
                residentName: latestPanic.residentName,
                userName: latestPanic.userId?.name,
                houseNo: latestPanic.houseNo || 'N/A',
                blockLot: latestPanic.blockLot || latestPanic.userId?.blockLot || 'N/A',
                location: latestPanic.location,
                emergencyType: latestPanic.emergencyType,
                status: latestPanic.status,
                createdAt: latestPanic.createdAt,
                formattedTime: _formatTimestamp(latestPanic.createdAt)
            };
            res.status(200).json(formattedAlert);
        } else {
            res.status(200).json(null);
        }
    } catch (error) {
        console.error("Latest Panic Error:", error);
        res.status(500).json({ error: "Failed to fetch latest alert" });
    }
});

// ✅ 4. SEND PANIC ALERT (Resident)
router.post('/send', auth.protect, async (req, res) => {
    try {
        const { latitude, longitude, residentName, houseNo, blockLot, emergencyType, message } = req.body;

        // Validate required fields
        if (!latitude || !longitude) {
            return res.status(400).json({ error: "Latitude and longitude are required" });
        }

        const newAlert = new PanicAlert({
            userId: req.user.id,
            residentName: residentName || req.user.name,
            houseNo: houseNo || req.user.blockLot?.split(' ')[0] || 'N/A',
            blockLot: blockLot || req.user.blockLot || 'N/A',
            location: { 
                latitude: latitude, 
                longitude: longitude,
                address: req.body.address || ''
            },
            emergencyType: emergencyType || 'Emergency Alert',
            status: 'Pending',
            message: message || '',
            respondingUnit: 'Waiting for dispatch...'
        });

        await newAlert.save();

        // Populate user data for the response
        const populatedAlert = await PanicAlert.findById(newAlert._id)
            .populate('userId', 'name email blockLot mobileNumber');

        const io = req.app.get('socketio');
        if (io) {
            // Prepare the alert data with complete information
            const alertData = {
                _id: populatedAlert._id,
                id: populatedAlert._id,
                userId: populatedAlert.userId._id,
                userName: populatedAlert.userId.name,
                name: populatedAlert.residentName,
                residentName: populatedAlert.residentName,
                blockLot: populatedAlert.blockLot,
                houseNo: populatedAlert.houseNo,
                latitude: populatedAlert.location.latitude,
                longitude: populatedAlert.location.longitude,
                emergencyType: populatedAlert.emergencyType,
                status: populatedAlert.status,
                message: populatedAlert.message,
                timestamp: populatedAlert.createdAt,
                createdAt: populatedAlert.createdAt,
                formattedTime: _formatTimestamp(populatedAlert.createdAt)
            };

            // 1. EMIT for Admin Dashboard (list view)
            io.emit('new-panic-alert', alertData);

            // 2. EMIT for Security Guard POP-UP (emergency alert)
            io.emit('emergency-alert', {
                _id: populatedAlert._id,
                id: populatedAlert._id,
                name: populatedAlert.residentName,
                residentName: populatedAlert.residentName,
                userName: populatedAlert.userId.name,
                blockLot: populatedAlert.blockLot,
                houseNo: populatedAlert.houseNo,
                latitude: populatedAlert.location.latitude,
                longitude: populatedAlert.location.longitude,
                emergencyType: populatedAlert.emergencyType,
                status: 'ACTIVE',
                message: populatedAlert.message,
                timestamp: populatedAlert.createdAt,
                formattedTime: _formatTimestamp(populatedAlert.createdAt)
            });

            console.log(`🚨 Emergency Alert Broadcasted to ${io.engine.clientsCount} clients!`);
            console.log(`📋 Emergency Type: ${populatedAlert.emergencyType}`);
            console.log(`📍 Location: ${populatedAlert.blockLot}`);
        }

        res.status(201).json({ 
            success: true,
            message: "Alert sent successfully and broadcasted to Admin & Security", 
            alert: {
                _id: newAlert._id,
                emergencyType: newAlert.emergencyType,
                blockLot: newAlert.blockLot,
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
            { 
                status: 'Resolved',
                resolvedAt: new Date(),
                resolvedBy: req.user.id
            }, 
            { new: true }
        ).populate('userId', 'name email blockLot');

        if (!updatedAlert) {
            return res.status(404).json({ error: "Panic alert not found" });
        }

        const io = req.app.get('socketio');
        if (io) {
            io.emit('panic-resolved', { 
                id: req.params.id,
                _id: req.params.id,
                status: 'Resolved',
                resolvedAt: new Date(),
                resolvedBy: req.user.name
            });
            console.log(`✅ Panic ${req.params.id} resolved and broadcasted`);
        }

        res.status(200).json({
            success: true,
            message: "Panic alert resolved successfully",
            alert: updatedAlert
        });
    } catch (err) {
        console.error("Resolve panic error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 6. GET SINGLE PANIC ALERT
router.get('/:id', auth.protect, async (req, res) => {
    try {
        const alert = await PanicAlert.findById(req.params.id)
            .populate('userId', 'name email blockLot mobileNumber')
            .populate('resolvedBy', 'name email');
        
        if (!alert) {
            return res.status(404).json({ error: "Alert not found" });
        }
        
        const formattedAlert = {
            _id: alert._id,
            id: alert._id,
            userId: alert.userId?._id,
            userName: alert.userId?.name,
            userEmail: alert.userId?.email,
            userBlockLot: alert.userId?.blockLot,
            residentName: alert.residentName,
            houseNo: alert.houseNo || 'N/A',
            blockLot: alert.blockLot || 'N/A',
            location: alert.location,
            emergencyType: alert.emergencyType,
            status: alert.status,
            respondingUnit: alert.respondingUnit,
            message: alert.message || '',
            createdAt: alert.createdAt,
            formattedTime: _formatTimestamp(alert.createdAt),
            resolvedAt: alert.resolvedAt,
            resolvedBy: alert.resolvedBy?.name
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
                emergencyType: updatedAlert.emergencyType,
                blockLot: updatedAlert.blockLot
            });
            console.log(`📢 Panic ${req.params.id} updated - Responding Unit: ${respondingUnit}`);
        }

        res.status(200).json({
            success: true,
            message: "Responding unit updated",
            alert: updatedAlert
        });
    } catch (err) {
        console.error("Error updating responding unit:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;