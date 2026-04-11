const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const Incident = require('../models/incidentModel');
const Payment = require('../models/paymentModel');
const Booking = require('../models/facilityModel'); // Adjust name if different
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/stats', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        // --- 1. REPORTS DATA ---
        const totalIncidents = await Incident.countDocuments();
        const submitted = await Incident.countDocuments({ status: 'pending' });
        const inProgress = await Incident.countDocuments({ status: 'in-progress' });
        const completed = await Incident.countDocuments({ status: 'resolved' });

        // --- 2. PAYMENTS DATA (Real counts) ---
        const paidWater = await Payment.countDocuments({ category: 'WATER', status: 'PAID' });
        const unpaidWater = await Payment.countDocuments({ category: 'WATER', status: 'UNPAID' });
        const paidDues = await Payment.countDocuments({ category: 'DUES', status: 'PAID' });
        const unpaidDues = await Payment.countDocuments({ category: 'DUES', status: 'UNPAID' });

        // --- 3. HOMEOWNERS DATA ---
        const totalResidents = await User.countDocuments({ role: { $in: ['resident', 'officer'] } });
        const occupiedAddresses = await User.distinct('blockLot');
        const totalLots = 600;

        // --- 4. FACILITY BOOKINGS ---
        const courtBookings = await Booking.countDocuments({ facilityName: 'COURT' });
        const clubhouseBookings = await Booking.countDocuments({ facilityName: 'CLUB HOUSE' });

        res.status(200).json({
            reports: {
                submitted,
                inProgress,
                completed,
                total: totalIncidents || 1, // Avoid division by zero
            },
            payments: {
                waterPaid: paidWater,
                waterUnpaid: unpaidWater,
                duesPaid: paidDues,
                duesUnpaid: unpaidDues
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