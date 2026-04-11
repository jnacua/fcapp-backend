const express = require('express');
const router = express.Router();
const PanicAlert = require('../models/panicModel');
const auth = require('../middleware/authMiddleware');

router.post('/send', auth.protect, async (req, res) => {
    try {
        const { latitude, longitude, residentName, houseNo } = req.body;

        // 1. Save to Database
        const newAlert = new PanicAlert({
            userId: req.user.id,
            residentName,
            houseNo,
            location: { latitude, longitude },
            status: 'Pending'
        });

        await newAlert.save();

        // 2. 🚨 EMIT REAL-TIME ALERT TO ADMIN 🚨
        const io = req.app.get('socketio');
        io.emit('new-panic-alert', {
            _id: newAlert._id,
            userName: residentName,
            blockLot: houseNo,
            latitude: latitude,
            longitude: longitude,
            status: 'Pending'
        });

        res.status(201).json({ 
            message: "Alert sent successfully and broadcasted to Admin", 
            alert: newAlert 
        });
        
    } catch (err) {
        console.error("Panic Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ ADDED: Resolve Route
// This updates the status and allows it to show up in the Reports Screen later
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