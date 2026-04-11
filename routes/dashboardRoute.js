const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const Incident = require('../models/incidentModel');
const Payment = require('../models/paymentModel');
const Booking = require('../models/facilityModel'); 
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/stats', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        // --- 1. REPORTS DATA (Case Insensitive) ---
        const totalIncidents = await Incident.countDocuments();
        const submitted = await Incident.countDocuments({ status: /pending/i });
        const inProgress = await Incident.countDocuments({ status: /in-progress/i });
        const completed = await Incident.countDocuments({ status: /resolved|completed/i });

        // --- 2. PAYMENTS DATA (Case Insensitive & Flexible Category) ---
        const waterPaid = await Payment.countDocuments({ category: /water/i, status: /paid/i });
        const waterUnpaid = await Payment.countDocuments({ category: /water/i, status: /unpaid/i });
        const duesPaid = await Payment.countDocuments({ category: /dues/i, status: /paid/i });
        const duesUnpaid = await Payment.countDocuments({ category: /dues/i, status: /unpaid/i });

        // --- 3. HOMEOWNERS DATA ---
        const totalResidents = await User.countDocuments({ role: { $in: ['resident', 'officer'] } });
        const occupiedAddresses = await User.distinct('blockLot');
        const totalLots = 600;

        // --- 4. FACILITY BOOKINGS ---
        const courtBookings = await Booking.countDocuments({ facilityName: /court/i });
        const clubhouseBookings = await Booking.countDocuments({ facilityName: /club house|clubhouse/i });

        res.status(200).json({
            reports: {
                submitted,
                inProgress,
                completed,
                total: totalIncidents || 1, 
            },
            payments: {
                waterPaid,
                waterUnpaid,
                duesPaid,
                duesUnpaid
            },
            homeowners: {
                total: totalResidents,
                occupied: occupiedAddresses.length,
                vacant: totalLots - occupiedAddresses.length,
                totalLots: totalLots
            },
            bookings: {
                court: courtBookings,
                clubhouse: clubhouseBookings
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;