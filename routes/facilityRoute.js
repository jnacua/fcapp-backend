const express = require('express');
const router = express.Router();
const multer = require('multer'); // ✅ Added Multer
const path = require('path'); // ✅ Added Path
const Facility = require('../models/facilityModel'); 
const Booking = require('../models/bookingModel');   
const { protect, restrictTo } = require('../middleware/authMiddleware');

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/payments/'); // ✅ Make sure this folder exists
    },
    filename: (req, file, cb) => {
        cb(null, `PROOF-${Date.now()}${path.extname(file.originalname)}`);
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
            .sort({ bookingDate: -1 });
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
// 5. SUBMIT BOOKING (From Mobile Phone) - ✅ UPDATED FOR IMAGES
// ============================================================
// Added upload.single('proofOfPayment') middleware
router.post('/book', protect, upload.single('proofOfPayment'), async (req, res) => {
    try {
        const newBooking = await Booking.create({
            userId: req.user._id,
            userName: req.user.name,
            address: req.user.address || "N/A",
            facilityName: req.body.facilityName,
            bookingDate: req.body.bookingDate,
            timeSlot: req.body.timeSlot,
            fee: req.body.fee,
            status: req.body.status,
            // ✅ SAVE THE IMAGE PATH
            proofOfPayment: req.file ? req.file.path : null 
        });
        
        res.status(201).json(newBooking);
    } catch (err) {
        console.error("Booking Save Error:", err);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;