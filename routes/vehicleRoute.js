const express = require('express');
const router = express.Router();
const Vehicle = require('../models/vehicleModel'); 
const { protect, restrictTo } = require('../middleware/authMiddleware');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ==========================================
// 0. CLOUDINARY CONFIGURATION
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const vehicleStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'vehicle_registrations', 
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 1000, crop: 'limit' }] 
    },
});

const upload = multer({ 
    storage: vehicleStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// --- RESIDENT ROUTES ---

// Submit Registration (Supports both Proof and Car images via Cloudinary)
router.post('/register', protect, upload.fields([
    { name: 'proofImage', maxCount: 1 },
    { name: 'carImage', maxCount: 1 }
]), async (req, res) => {
    try {
        const { vehicleType, proofType, licenseNumber } = req.body;

        // ✅ Extract Cloudinary Secure URLs from the uploaded files
        const proofPath = req.files['proofImage'] ? req.files['proofImage'][0].path : null;
        const carPath = req.files['carImage'] ? req.files['carImage'][0].path : null;

        const newVehicle = new Vehicle({
            owner: req.user.id,
            vehicleType,
            proofType,
            licenseNumber,
            // These fields now store permanent https://res.cloudinary.com/... links
            proofImagePath: proofPath,
            carImagePath: carPath,
            status: 'Pending',
            qrData: `VEHICLE-${licenseNumber}-${Date.now()}` 
        });

        await newVehicle.save();
        
        console.log("✅ Vehicle Registered with Cloudinary images.");
        res.status(201).json({ message: "Registration submitted for approval", vehicle: newVehicle });
    } catch (err) {
        console.error("❌ Vehicle Registration Error:", err.message);
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
router.get('/admin/all', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const vehicles = await Vehicle.find().populate('owner', 'name email').sort({ createdAt: -1 });
        res.status(200).json(vehicles);
    } catch (err) {
        res.status(500).json({ message: "Error fetching all vehicles" });
    }
});

// Approve/Reject Vehicle
router.put('/admin/approve/:id', protect, restrictTo('ADMIN'), async (req, res) => {
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