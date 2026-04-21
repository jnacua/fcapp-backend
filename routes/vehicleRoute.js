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

// ==========================================
// 1. RESIDENT ROUTES
// ==========================================

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

// ==========================================
// 2. SECURITY / SCANNER ROUTES
// ==========================================

// Get vehicle details by QR data (for security scanning)
router.get('/scan/:qrData', protect, restrictTo('ADMIN', 'security'), async (req, res) => {
    try {
        const { qrData } = req.params;
        
        // Decode URL-encoded QR data
        const decodedQRData = decodeURIComponent(qrData);
        
        // Find vehicle by QR data and populate owner details
        const vehicle = await Vehicle.findOne({ qrData: decodedQRData }).populate('owner', 'name email mobileNumber blockLot type profileImage');
        
        if (!vehicle) {
            return res.status(404).json({ 
                success: false, 
                message: "Vehicle not found in the system" 
            });
        }
        
        // Check if vehicle is approved
        if (vehicle.status !== 'Approved') {
            return res.status(403).json({ 
                success: false, 
                message: `Vehicle is ${vehicle.status}. Access denied.`,
                status: vehicle.status 
            });
        }
        
        // Return vehicle and owner details
        res.status(200).json({
            success: true,
            data: {
                plateNumber: vehicle.licenseNumber,
                ownerName: vehicle.owner.name || 'N/A',
                ownerEmail: vehicle.owner.email || 'N/A',
                ownerMobile: vehicle.owner.mobileNumber || 'N/A',
                ownerAddress: vehicle.owner.blockLot || 'N/A',
                residentType: vehicle.owner.type || 'N/A',
                vehicleType: vehicle.vehicleType || 'N/A',
                status: vehicle.status,
                qrData: vehicle.qrData,
                scanTimestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error("❌ Scan Error:", err.message);
        res.status(500).json({ 
            success: false, 
            message: "Server Error", 
            error: err.message 
        });
    }
});

// Alternative: Get vehicle by license number (for manual entry)
router.get('/search/:licenseNumber', protect, restrictTo('ADMIN', 'security'), async (req, res) => {
    try {
        const { licenseNumber } = req.params;
        
        const vehicle = await Vehicle.findOne({ 
            licenseNumber: { $regex: new RegExp(`^${licenseNumber}$`, 'i') } 
        }).populate('owner', 'name email mobileNumber blockLot type');
        
        if (!vehicle) {
            return res.status(404).json({ 
                success: false, 
                message: "Vehicle not found" 
            });
        }
        
        if (vehicle.status !== 'Approved') {
            return res.status(403).json({ 
                success: false, 
                message: `Vehicle is ${vehicle.status}` 
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                plateNumber: vehicle.licenseNumber,
                ownerName: vehicle.owner.name,
                ownerEmail: vehicle.owner.email,
                ownerMobile: vehicle.owner.mobileNumber,
                ownerAddress: vehicle.owner.blockLot,
                vehicleType: vehicle.vehicleType,
                status: vehicle.status
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Search failed" });
    }
});

// ==========================================
// 3. ADMIN ROUTES
// ==========================================

// Get All Vehicles (For the Web Admin Dashboard)
router.get('/admin/all', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const vehicles = await Vehicle.find().populate('owner', 'name email mobileNumber blockLot type').sort({ createdAt: -1 });
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

// Get single vehicle details (for admin view)
router.get('/admin/vehicle/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id).populate('owner', 'name email mobileNumber blockLot type proofOfResidencyPath');
        
        if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }
        
        res.status(200).json(vehicle);
    } catch (err) {
        res.status(500).json({ message: "Error fetching vehicle" });
    }
});

// Delete vehicle (admin only)
router.delete('/admin/vehicle/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
        
        if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }
        
        res.status(200).json({ message: "Vehicle deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting vehicle" });
    }
});

module.exports = router;