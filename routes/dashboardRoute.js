const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const Incident = require('../models/incidentModel');
const Payment = require('../models/paymentModel');
const Booking = require('../models/bookingModel'); // Match your filename
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/stats', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        // --- 1. REPORTS DATA ---
        const totalIncidents = await Incident.countDocuments();
        const submitted = await Incident.countDocuments({ status: /pending/i });
        const inProgress = await Incident.countDocuments({ status: /in-progress/i });
        const completed = await Incident.countDocuments({ status: /resolved|completed/i });

        // --- 2. PAYMENTS DATA (Matches your Payment Schema: 'type' field) ---
        const waterPaid = await Payment.countDocuments({ type: /Water Bill/i, status: /PAID/i });
        const waterUnpaid = await Payment.countDocuments({ type: /Water Bill/i, status: /UNPAID/i });
        
        const duesPaid = await Payment.countDocuments({ type: /Monthly Dues/i, status: /PAID/i });
        const duesUnpaid = await Payment.countDocuments({ type: /Monthly Dues/i, status: /UNPAID/i });

        // --- 3. HOMEOWNERS DATA ---
        const totalResidents = await User.countDocuments({ role: { $in: ['resident', 'officer'] } });
        const occupiedAddresses = await User.distinct('blockLot');
        const totalLots = 600;

        // --- 4. FACILITY BOOKINGS (Matches your Booking Schema: 'facilityName' field) ---
        // Only count 'Approved' or 'APPROVED' status
        const court = await Booking.countDocuments({ facilityName: /court/i, status: /approved/i });
        const clubhouse = await Booking.countDocuments({ facilityName: /club house|clubhouse/i, status: /approved/i });

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
                vacant: Math.max(0, totalLots - occupiedAddresses.length),
                totalLots: totalLots
            },
            bookings: {
                court,
                clubhouse
            }
        });
    } catch (err) {
        console.error("Dashboard Stats Error:", err.message);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
});

module.exports = router;