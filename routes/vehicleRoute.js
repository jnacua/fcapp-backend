const express = require('express');
const router = express.Router();
const Vehicle = require('../models/vehicleModel'); // Matches your export
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: './uploads/vehicles/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- RESIDENT ROUTES ---

// Submit Registration
router.post('/register', protect, upload.fields([
    { name: 'proofImage', maxCount: 1 },
    { name: 'carImage', maxCount: 1 }
]), async (req, res) => {
    try {
        const { vehicleType, proofType, licenseNumber } = req.body;

        const newVehicle = new Vehicle({
            owner: req.user.id,
            vehicleType,
            proofType,
            licenseNumber,
            // Convert backslashes to forward slashes for cross-platform URL compatibility
            proofImagePath: req.files['proofImage'] ? req.files['proofImage'][0].path.replace(/\\/g, "/") : null,
            carImagePath: req.files['carImage'] ? req.files['carImage'][0].path.replace(/\\/g, "/") : null,
            status: 'Pending',
            qrData: `VEHICLE-${licenseNumber}-${Date.now()}` 
        });

        await newVehicle.save();
        res.status(201).json({ message: "Registration submitted for approval" });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// Get My Vehicles (For the Flutter App to display QR or Status)
router.get('/my-vehicles', protect, async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ owner: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(vehicles);
    } catch (err) {
        res.status(500).json({ message: "Error fetching data" });
    }
});

// --- ADMIN ROUTES ---

// Get All Vehicles (For the Web Admin Dashboard)
router.get('/admin/all', protect, async (req, res) => {
    try {
        const vehicles = await Vehicle.find().populate('owner', 'name email');
        res.status(200).json(vehicles);
    } catch (err) {
        res.status(500).json({ message: "Error fetching all vehicles" });
    }
});

// Approve/Reject Vehicle
router.put('/admin/approve/:id', protect, async (req, res) => {
    try {
        const { status } = req.body; // 'Approved' or 'Rejected'

        const updatedVehicle = await Vehicle.findByIdAndUpdate(
            req.params.id,
            { status: status },
            { new: true }
        );

        if (!updatedVehicle) return res.status(404).json({ message: "Vehicle not found" });

        res.status(200).json({ message: `Vehicle ${status}`, vehicle: updatedVehicle });
    } catch (err) {
        res.status(500).json({ message: "Update failed" });
    }
});

module.exports = router;