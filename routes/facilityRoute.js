const express = require('express');
const router = express.Router();
const Facility = require('../models/facilityModel'); 
const Booking = require('../models/bookingModel');   
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ==========================================
// 1. GET ALL FACILITIES (Fills the Admin Cards)
// ==========================================
router.get('/all', protect, async (req, res) => {
    try {
        const facilities = await Facility.find();
        res.status(200).json(facilities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. GET ALL BOOKINGS (Fills the Bookings Table)
// ==========================================
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

// ==========================================
// 3. CREATE NEW FACILITY (Admin Only)
// ==========================================
router.post('/add', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const newFacility = await Facility.create(req.body);
        res.status(201).json(newFacility);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ==========================================
// 4. REVIEW BOOKING (Approve/Reject)
// ==========================================
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
// 5. SUBMIT BOOKING (From Mobile Phone) - ✅ ADDED THIS SECTION
// ============================================================
router.post('/book', protect, async (req, res) => {
    try {
        // This ensures the booking is linked to the logged-in resident
        const newBooking = await Booking.create({
            userId: req.user._id,
            userName: req.user.name,
            address: req.user.address || "N/A", // Uses user data from token
            ...req.body // Receives facilityName, bookingDate, timeSlot, status
        });
        res.status(201).json(newBooking);
    } catch (err) {
        console.error("Booking Save Error:", err);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;