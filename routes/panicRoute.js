const express = require('express');
const router = express.Router();
const PanicAlert = require('../models/panicModel');
const auth = require('../middleware/authMiddleware');

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
        res.status(201).json({ message: "Alert sent successfully", alert: newAlert });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;