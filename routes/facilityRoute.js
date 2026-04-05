const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Facility = require('../models/facilityModel'); 
const Booking = require('../models/bookingModel');   
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ✅ ENSURE DIRECTORIES EXIST
const uploadDir = 'uploads/payments/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        // Cleaning filename to avoid issues with spaces or special chars
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `PROOF-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// 1. GET ALL FACILITIES
router.get('/all', protect, async (req, res) => {
    try {
        const facilities = await Facility.find();
        res.status(200).json(facilities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. GET ALL BOOKINGS
router.get('/bookings', protect, async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('userId', 'name address')
            .sort({ createdAt: -1 }); // Changed to createdAt to see newest first
        res.status(200).json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. CREATE NEW FACILITY (Admin Only)
router.post('/add', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const newFacility = await Facility.create(req.body);
        res.status(201).json(newFacility);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. REVIEW BOOKING (Approve/Reject)
router.patch('/review/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        res.status(200).json(updatedBooking);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ============================================================
// 5. SUBMIT BOOKING (From Mobile Phone)
// ============================================================
// ✅ FIX: Moved upload.single BEFORE protect. 
// This ensures userId and userName are parsed into req.body before validation.
router.post('/book', upload.single('proofOfPayment'), protect, async (req, res) => {
    try {
        console.log("--- NEW BOOKING ATTEMPT ---");
        console.log("Body Content:", req.body);
        console.log("File Content:", req.file);

        // Pulling data with fallbacks
        const userId = req.body.userId || (req.user ? req.user._id : null);
        const userName = req.body.userName || (req.user ? req.user.name : "Resident");
        
        // Manual validation before database attempt to avoid generic 400 error
        if (!userId || !userName) {
            return res.status(400).json({ 
                error: "Missing User Identification", 
                details: `userId: ${userId}, userName: ${userName}` 
            });
        }

        const newBooking = await Booking.create({
            userId: userId,
            userName: userName,
            address: req.body.address || (req.user ? req.user.address : "N/A"),
            facilityName: req.body.facilityName,
            bookingDate: req.body.bookingDate,
            timeSlot: req.body.timeSlot,
            fee: req.body.fee ? parseFloat(req.body.fee) : 0,
            status: req.body.status || 'Pending',
            // Ensure path is saved correctly for static serving
            proofOfPayment: req.file ? req.file.path.replace(/\\/g, "/") : "" 
        });
        
        console.log("✅ Booking Saved Successfully:", newBooking._id);
        res.status(201).json(newBooking);
    } catch (err) {
        console.error("❌ Booking Save Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;