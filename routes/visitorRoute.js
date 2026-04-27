const express = require('express');
const router = express.Router();
const VisitorLog = require('../models/visitorModel'); 
const auth = require('../middleware/authMiddleware');

// ✅ IMPROVED Helper function to format timestamp with error handling
function _formatTimestamp(date) {
    if (!date) return '--:-- --';
    try {
        // Convert to Date object if it's a string
        const d = typeof date === 'string' ? new Date(date) : date;
        
        // Check if date is valid
        if (isNaN(d.getTime())) {
            console.log("⚠️ Invalid date received:", date);
            return '--:-- --';
        }
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let hour = d.getHours();
        const minute = d.getMinutes().toString().padStart(2, '0');
        const period = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} - ${hour}:${minute} ${period}`;
    } catch (err) {
        console.error("Format timestamp error:", err);
        return '--:-- --';
    }
}

// ✅ POST: Save a new visitor entry (IMPROVED)
router.post('/log-entry', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        console.log("📝 Received visitor data:", req.body);
        
        const { name, purpose, hostName, plateNumber } = req.body;
        
        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, error: "Visitor name is required" });
        }
        if (!hostName || hostName.trim() === '') {
            return res.status(400).json({ success: false, error: "Resident name is required" });
        }
        
        // ✅ Use new Date() - don't rely on frontend timestamp
        const entryTime = new Date();
        
        console.log(`📝 Creating visitor log with entryTime: ${entryTime.toISOString()}`);

        const newLog = new VisitorLog({
            visitorName: name.trim(),
            purpose: purpose || 'Visit',
            residentToVisit: hostName.trim(),
            plateNumber: plateNumber && plateNumber !== 'N/A' ? plateNumber.toUpperCase().trim() : 'N/A',
            recordedBy: req.user.id,
            recordedByName: req.user.name || 'Security',
            entryTime: entryTime,  // ✅ Explicitly set entryTime
            status: 'COMPLETED',
            type: 'VISITOR'
        });

        const savedLog = await newLog.save();
        
        console.log(`✅ Visitor logged: ${name} at ${savedLog.entryTime}`);
        console.log(`✅ Saved log ID: ${savedLog._id}, entryTime: ${savedLog.entryTime}`);
        
        res.status(201).json({ 
            success: true, 
            message: "Visitor entry saved to database!",
            log: {
                id: savedLog._id,
                name: savedLog.visitorName,
                purpose: savedLog.purpose,
                hostName: savedLog.residentToVisit,
                plateNumber: savedLog.plateNumber,
                timestamp: savedLog.entryTime,
                formattedTime: _formatTimestamp(savedLog.entryTime),
                status: savedLog.status
            }
        });
    } catch (err) {
        console.error("❌ Visitor Log Error:", err.message);
        console.error("Stack:", err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ GET: All visitor logs (IMPROVED)
router.get('/all', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const logs = await VisitorLog.find()
            .sort({ entryTime: -1 })
            .limit(100);
        
        console.log(`📊 Found ${logs.length} visitor logs`);
        
        // Log first log for debugging
        if (logs.length > 0) {
            console.log(`📊 Sample log - entryTime: ${logs[0].entryTime}, type: ${typeof logs[0].entryTime}`);
        }
        
        const formattedLogs = logs.map(log => ({
            id: log._id,
            type: 'VISITOR',
            name: log.visitorName,
            purpose: log.purpose,
            hostName: log.residentToVisit,
            plateNumber: log.plateNumber || 'N/A',
            status: log.status || 'COMPLETED',
            timestamp: log.entryTime,
            formattedTime: _formatTimestamp(log.entryTime),
            recordedBy: log.recordedByName || 'Security'
        }));
        
        res.status(200).json(formattedLogs);
    } catch (err) {
        console.error("❌ Fetch Visitor Logs Error:", err.message);
        console.error("Stack:", err.stack);
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
            timestamp: log.entryTime,
            formattedTime: _formatTimestamp(log.entryTime)
        }));
        
        res.status(200).json(formattedLogs);
    } catch (err) {
        console.error("❌ Recent Visitor Logs Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ GET: Visitor log by ID
router.get('/:id', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const log = await VisitorLog.findById(req.params.id);
        if (!log) {
            return res.status(404).json({ success: false, error: "Log not found" });
        }
        res.status(200).json({
            id: log._id,
            name: log.visitorName,
            purpose: log.purpose,
            hostName: log.residentToVisit,
            plateNumber: log.plateNumber,
            timestamp: log.entryTime,
            formattedTime: _formatTimestamp(log.entryTime),
            status: log.status
        });
    } catch (err) {
        console.error("❌ Fetch Visitor Log Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ DELETE: Delete visitor log (admin only)
router.delete('/:id', auth.protect, auth.restrictTo('ADMIN'), async (req, res) => {
    try {
        const log = await VisitorLog.findByIdAndDelete(req.params.id);
        if (!log) {
            return res.status(404).json({ success: false, error: "Log not found" });
        }
        console.log(`✅ Deleted visitor log: ${log.visitorName}`);
        res.status(200).json({ success: true, message: "Log deleted successfully" });
    } catch (err) {
        console.error("❌ Delete Visitor Log Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ DEBUG: Check database entries
router.get('/debug/check', auth.protect, auth.restrictTo('ADMIN', 'SECURITY'), async (req, res) => {
    try {
        const allLogs = await VisitorLog.find().sort({ entryTime: -1 }).limit(10);
        const count = await VisitorLog.countDocuments();
        
        res.json({
            totalCount: count,
            recentLogs: allLogs.map(log => ({
                id: log._id,
                name: log.visitorName,
                entryTime: log.entryTime,
                entryTimeString: log.entryTime ? log.entryTime.toString() : 'null',
                hasEntryTime: !!log.entryTime,
                createdAt: log.createdAt
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;