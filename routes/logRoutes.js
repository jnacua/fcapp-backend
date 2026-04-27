const express = require('express');
const router = express.Router();
const Visitor = require('../models/visitorModel'); 
const Panic = require('../models/panicModel');

let vehicleScanLogs = [];

// ✅ Unified formatTimestamp - converts UTC to Philippine Time (UTC+8)
function formatTimestamp(date) {
    if (!date) return '--:-- --';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '--:-- --';
        
        // Convert UTC to Philippine Time (add 8 hours)
        const philippineTime = new Date(d.getTime() + (8 * 60 * 60 * 1000));
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let hour = philippineTime.getUTCHours();
        const minute = philippineTime.getUTCMinutes().toString().padStart(2, '0');
        const period = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        if (hour === 0) hour = 12;
        
        return `${months[philippineTime.getUTCMonth()]} ${philippineTime.getUTCDate()}, ${philippineTime.getUTCFullYear()} - ${hour}:${minute} ${period}`;
    } catch (e) {
        console.error("Error formatting timestamp:", date, e);
        return '--:-- --';
    }
}

// Helper function to format details
function formatDetails(log, type) {
    if (type === 'VISITOR') {
        let details = log.visitorName || log.name || 'Unknown Visitor';
        if (log.residentToVisit) {
            details += ` - Visiting ${log.residentToVisit}`;
        }
        if (log.plateNumber && log.plateNumber !== 'N/A') {
            details += ` (Vehicle: ${log.plateNumber})`;
        }
        if (log.purpose && log.purpose !== 'Visit') {
            details += ` - ${log.purpose}`;
        }
        return details;
    } else if (type === 'PANIC') {
        const name = log.residentName || log.name || 'Unknown Resident';
        const location = log.blockLot || log.houseNo || 'Unknown Location';
        const emergencyType = log.emergencyType ? ` [${log.emergencyType}]` : '';
        return `${name} - Location: ${location}${emergencyType}`;
    } else if (type === 'VEHICLE_SCAN') {
        const plateNumber = log.plateNumber || 'N/A';
        const ownerName = log.ownerName || 'Unknown Owner';
        const vehicleType = log.vehicleType || '';
        return `${plateNumber} - ${ownerName}${vehicleType ? ` (${vehicleType})` : ''}`;
    }
    return log.details || 'N/A';
}

// ✅ 1. POST - Save vehicle scan log (Store in UTC)
router.post('/vehicle-scan', async (req, res) => {
    try {
        console.log("📝 Vehicle scan request received:", req.body);
        
        const now = new Date(); // UTC
        
        const logEntry = {
            ...req.body,
            _id: Date.now().toString(),
            type: 'VEHICLE_SCAN',
            createdAt: now,
            timestamp: now.toISOString()
        };
        
        vehicleScanLogs.unshift(logEntry);
        
        if (vehicleScanLogs.length > 500) {
            vehicleScanLogs = vehicleScanLogs.slice(0, 500);
        }
        
        console.log(`✅ Vehicle scan logged: ${logEntry.plateNumber} at ${logEntry.timestamp}`);
        res.status(201).json({ success: true, log: logEntry });
    } catch (err) {
        console.error("❌ Vehicle scan log error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 2. Get Statistics
router.get('/security-stats', async (req, res) => {
    try {
        const totalVisitors = await Visitor.countDocuments();
        const activePanicCount = await Panic.countDocuments({ status: 'Pending' });
        const totalPanicCount = await Panic.countDocuments();
        const vehicleScanCount = vehicleScanLogs.length;
        
        // Get today's UTC date range
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        
        const visitorsToday = await Visitor.countDocuments({
            entryTime: { $gte: today, $lt: tomorrow }
        });
        
        const vehicleScansToday = vehicleScanLogs.filter(v => {
            const scanTime = new Date(v.timestamp || v.createdAt);
            return scanTime >= today && scanTime < tomorrow;
        }).length;

        res.json({
            visitors: totalVisitors,
            visitorsToday: visitorsToday,
            panics: totalPanicCount,
            vehicleScans: vehicleScanCount,
            vehicleScansToday: vehicleScansToday
        });
    } catch (err) {
        console.error("❌ Stats Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 3. GET all consolidated logs
router.get('/all', async (req, res) => {
    try {
        // Get visitor logs
        const visitors = await Visitor.find()
            .sort({ entryTime: -1 })
            .limit(100);
        
        const formattedVisitors = visitors.map(v => ({ 
            type: 'VISITOR',
            id: v._id,
            name: v.visitorName,
            visitorName: v.visitorName,
            details: formatDetails(v, 'VISITOR'),
            status: v.status || 'COMPLETED',
            timestamp: v.entryTime,
            formattedTime: formatTimestamp(v.entryTime),
            plateNumber: v.plateNumber,
            purpose: v.purpose,
            residentToVisit: v.residentToVisit
        }));
        
        // Get panic alerts
        const panics = await Panic.find()
            .sort({ createdAt: -1 })
            .limit(100);
        
        const formattedPanics = panics.map(p => ({ 
            type: 'PANIC',
            id: p._id,
            name: p.residentName,
            residentName: p.residentName,
            details: formatDetails(p, 'PANIC'),
            status: p.status === 'Pending' ? 'ACTIVE' : 'RESOLVED',
            timestamp: p.createdAt,
            formattedTime: formatTimestamp(p.createdAt),
            blockLot: p.blockLot || 'N/A'
        }));
        
        // Get vehicle scan logs
        const formattedVehicleScans = vehicleScanLogs.map(v => ({ 
            type: 'VEHICLE',
            id: v._id,
            name: v.ownerName,
            ownerName: v.ownerName,
            details: formatDetails(v, 'VEHICLE_SCAN'),
            status: v.status || 'APPROVED & AUTHORIZED',
            timestamp: v.timestamp,
            formattedTime: formatTimestamp(v.timestamp),
            plateNumber: v.plateNumber,
            vehicleType: v.vehicleType
        }));

        // Combine all logs
        let combinedLogs = [...formattedVisitors, ...formattedPanics, ...formattedVehicleScans];

        // Sort by timestamp (newest first)
        combinedLogs.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp) : new Date(0);
            const timeB = b.timestamp ? new Date(b.timestamp) : new Date(0);
            return timeB - timeA;
        });

        res.json(combinedLogs);
    } catch (err) {
        console.error("❌ Log Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 4. GET active panic alerts
router.get('/panic/active', async (req, res) => {
    try {
        const activePanics = await Panic.find({ status: 'Pending' })
            .sort({ createdAt: -1 });
        
        const formattedActivePanics = activePanics.map(p => ({
            id: p._id,
            residentName: p.residentName,
            blockLot: p.blockLot,
            status: p.status,
            timestamp: p.createdAt,
            formattedTime: formatTimestamp(p.createdAt)
        }));
        
        res.json(formattedActivePanics);
    } catch (err) {
        console.error("❌ Active Panics Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;