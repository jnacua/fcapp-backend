const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Facility = require('../models/facilityModel'); 
const Booking = require('../models/bookingModel');   
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ==========================================
// 0. CLOUDINARY & MULTER CONFIGURATION
// ==========================================
// This MUST stay at the top so 'upload' is defined before routes
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'facility_proofs', 
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 1000, crop: 'limit' }] 
    },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ------------------------------------------------------------
// 1. GET ALL FACILITIES
// ------------------------------------------------------------
router.get('/all', protect, async (req, res) => {
    try {
        const facilities = await Facility.find();
        res.status(200).json(facilities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 2. GET ALL BOOKINGS
// ------------------------------------------------------------
router.get('/bookings', protect, async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('userId', 'name address')
            .sort({ createdAt: -1 }); 
        res.status(200).json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 3. CREATE NEW FACILITY (Admin Only)
// ------------------------------------------------------------
router.post('/add', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { name, price, capacity } = req.body;

        if (!name || !price || !capacity) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        const newFacility = await Facility.create({
            name: name.toUpperCase(),
            price: parseFloat(price),
            capacity: parseInt(capacity),
            description: req.body.description || ""
        });

        res.status(201).json(newFacility);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 4. DELETE FACILITY (Admin Only)
// ------------------------------------------------------------
router.delete('/delete/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const deletedFacility = await Facility.findByIdAndDelete(req.params.id);
        if (!deletedFacility) {
            return res.status(404).json({ error: "Facility not found." });
        }
        res.status(200).json({ message: "Facility deleted successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 5. REVIEW BOOKING (Approve/Reject/Cancel - Admin Only)
// ------------------------------------------------------------
router.patch('/review/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { status, reason } = req.body; // ✅ Capture reason from admin panel

        if (!status) {
            return res.status(400).json({ error: "No status provided." });
        }

        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            { 
                status: status.toUpperCase(),
                reason: reason || "" // ✅ Save the reason provided by admin
            }, 
            { new: true, runValidators: true }
        );

        if (!updatedBooking) {
            return res.status(404).json({ error: "Booking record not found." });
        }

        res.status(200).json(updatedBooking);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 6. SUBMIT BOOKING (From Mobile Phone)
// ------------------------------------------------------------
router.post('/book', upload.single('proofOfPayment'), protect, async (req, res) => {
    try {
        const userId = req.body.userId || (req.user ? req.user._id : null);
        const userName = req.body.userName || (req.user ? req.user.name : "Resident");
        
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const newBooking = await Booking.create({
            userId: userId,
            userName: userName,
            address: req.body.address || (req.user ? req.user.address : "N/A"),
            facilityName: req.body.facilityName,
            bookingDate: req.body.bookingDate,
            timeSlot: req.body.timeSlot,
            fee: req.body.fee ? parseFloat(req.body.fee) : 0,
            status: req.body.status || 'PENDING',
            proofOfPayment: req.file ? req.file.path : "" 
        });
        
        res.status(201).json(newBooking);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 7. DELETE/CANCEL BOOKING
// ------------------------------------------------------------
router.delete('/bookings/:id', protect, async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Reservation removed successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 8. UPDATE FACILITY RATE & CAPACITY (Admin Only)
// ------------------------------------------------------------
router.patch('/update/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { price, capacity } = req.body;
        
        const updatedFacility = await Facility.findByIdAndUpdate(
            req.params.id,
            { 
                price: parseFloat(price), 
                capacity: parseInt(capacity) 
            },
            { new: true, runValidators: true }
        );

        if (!updatedFacility) {
            return res.status(404).json({ error: "Facility not found." });
        }

        res.status(200).json(updatedFacility);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;