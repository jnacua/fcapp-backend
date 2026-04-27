const express = require('express');
const router = express.Router();
// ✅ Ensure you have a Visitor model created in your models folder
const VisitorLog = require('../models/visitorModel'); 
const auth = require('../middleware/authMiddleware');

// ✅ POST: Save a new visitor entry
router.post('/log-entry', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const { name, purpose, hostName, plateNumber, timestamp } = req.body;
        
        // ✅ Use provided timestamp or create new one
        const entryTime = timestamp ? new Date(timestamp) : new Date();

        const newLog = new VisitorLog({
            visitorName: name,
            purpose: purpose || 'Visit',
            residentToVisit: hostName,
            plateNumber: plateNumber || 'N/A', // ✅ Add plate number field
            recordedBy: req.user.id,
            recordedByName: req.user.name || 'Security',
            entryTime: entryTime,
            status: 'COMPLETED',
            type: 'VISITOR'
        });

        await newLog.save();
        
        console.log(`✅ Visitor logged: ${name} at ${entryTime.toISOString()}`);
        
        // ✅ Return the saved log with formatted timestamp
        res.status(201).json({ 
            success: true, 
            message: "Visitor entry saved to database!",
            log: {
                id: newLog._id,
                name: newLog.visitorName,
                purpose: newLog.purpose,
                hostName: newLog.residentToVisit,
                plateNumber: newLog.plateNumber,
                timestamp: newLog.entryTime.toISOString(),
                formattedTime: _formatTimestamp(newLog.entryTime),
                status: newLog.status
            }
        });
    } catch (err) {
        console.error("Visitor Log Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ GET: All visitor logs (for admin/security)
router.get('/all', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const logs = await VisitorLog.find()
            .sort({ entryTime: -1 }) // Newest first
            .populate('recordedBy', 'name email');
        
        // Format the logs for frontend display
        const formattedLogs = logs.map(log => ({
            id: log._id,
            type: 'VISITOR',
            name: log.visitorName,
            purpose: log.purpose,
            hostName: log.residentToVisit,
            plateNumber: log.plateNumber || 'N/A',
            status: log.status || 'COMPLETED',
            timestamp: log.entryTime.toISOString(),
            formattedTime: _formatTimestamp(log.entryTime),
            recordedBy: log.recordedByName || 'Security'
        }));
        
        res.status(200).json(formattedLogs);
    } catch (err) {
        console.error("Fetch Visitor Logs Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ GET: Recent visitor logs (last 24 hours)
router.get('/recent', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const logs = await VisitorLog.find({
            entryTime: { $gte: twentyFourHoursAgo }
        }).sort({ entryTime: -1 });
        
        const formattedLogs = logs.map(log => ({
            id: log._id,
            name: log.visitorName,
            purpose: log.purpose,
            hostName: log.residentToVisit,
            plateNumber: log.plateNumber || 'N/A',
            timestamp: log.entryTime.toISOString(),
            formattedTime: _formatTimestamp(log.entryTime)
        }));
        
        res.status(200).json(formattedLogs);
    } catch (err) {
        console.error("Recent Visitor Logs Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ Helper function to format timestamp for display
function _formatTimestamp(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, '0');
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} - ${hour}:${minute} ${period}`;
}

module.exports = router;