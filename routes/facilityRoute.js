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
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `PROOF-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

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
            return res.status(400).json({ error: "Missing required fields: Name, Price, or Capacity." });
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
// ✅ UPDATED: Added better error handling and forced UPPERCASE status
// ------------------------------------------------------------
router.patch('/review/:id', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const statusValue = req.body.status;

        if (!statusValue) {
            return res.status(400).json({ error: "No status provided in request body." });
        }

        // Find and update the status explicitly to what Admin sent (Standardized to UPPERCASE)
        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status: statusValue.toUpperCase() }, 
            { new: true, runValidators: true }
        );

        if (!updatedBooking) {
            return res.status(404).json({ error: "Booking record not found." });
        }

        console.log(`✅ Booking ${req.params.id} updated to: ${statusValue.toUpperCase()}`);
        res.status(200).json(updatedBooking);
    } catch (err) {
        console.error("❌ PATCH Review Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 6. SUBMIT BOOKING (From Mobile Phone)
// ------------------------------------------------------------
router.post('/book', upload.single('proofOfPayment'), protect, async (req, res) => {
    try {
        console.log("--- NEW BOOKING ATTEMPT ---");
        const userId = req.body.userId || (req.user ? req.user._id : null);
        const userName = req.body.userName || (req.user ? req.user.name : "Resident");
        
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
            status: req.body.status || 'PENDING',
            proofOfPayment: req.file ? req.file.path.replace(/\\/g, "/") : "" 
        });
        
        res.status(201).json(newBooking);
    } catch (err) {
        console.error("❌ Booking Save Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// 7. DELETE/CANCEL BOOKING (Resident or Admin)
// ------------------------------------------------------------
router.delete('/bookings/:id', protect, async (req, res) => {
    try {
        const bookingId = req.params.id;

        // 1. Find the booking to handle file cleanup
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ error: "Reservation not found." });
        }

        // 2. Delete the proof of payment image from the folder
        if (booking.proofOfPayment) {
            const fullPath = path.join(__dirname, '..', booking.proofOfPayment);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        // 3. Delete the record from MongoDB
        await Booking.findByIdAndDelete(bookingId);

        res.status(200).json({ message: "Reservation cancelled successfully." });
    } catch (err) {
        console.error("❌ Delete Booking Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;