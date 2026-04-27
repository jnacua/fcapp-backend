const express = require('express');
const router = express.Router();
const Visitor = require('../models/visitorModel'); 
const Panic = require('../models/panicModel');     
const VehicleScan = require('../models/vehicleScanModel'); // Create this model if needed

// Helper function to format timestamp for display
function formatTimestamp(date) {
    if (!date) return '--:-- --';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, '0');
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} - ${hour}:${minute} ${period}`;
}

// Helper function to format details based on log type
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
        const location = log.houseNo || log.blockLot || 'Unknown Location';
        return `${name} - Location: ${location}`;
    } else if (type === 'VEHICLE_SCAN') {
        const plateNumber = log.plateNumber || 'N/A';
        const ownerName = log.ownerName || 'Unknown Owner';
        const vehicleType = log.vehicleType || '';
        return `${plateNumber} - ${ownerName}${vehicleType ? ` (${vehicleType})` : ''}`;
    }
    return log.details || 'N/A';
}

// In-memory storage for vehicle scans (if no database model yet)
let vehicleScanLogs = [];

// ✅ 1. Get Statistics for Dashboard Cards
router.get('/security-stats', async (req, res) => {
    try {
        // Count visitors
        const visitorCount = await Visitor.countDocuments();
        
        // Count active panics (Pending status)
        const activePanicCount = await Panic.countDocuments({ status: 'Pending' });
        
        // Count total panics
        const totalPanicCount = await Panic.countDocuments();
        
        // Count vehicle scans
        const vehicleScanCount = vehicleScanLogs.length;
        
        // Get today's visitors
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const visitorsToday = await Visitor.countDocuments({
            entryTime: { $gte: today, $lt: tomorrow }
        });

        console.log(`📊 Stats: Visitors(${visitorCount}) | Visitors Today(${visitorsToday}) | Active Panics(${activePanicCount}) | Vehicle Scans(${vehicleScanCount})`);

        res.json({
            visitors: visitorCount,
            visitorsToday: visitorsToday,
            panics: activePanicCount,
            totalPanics: totalPanicCount,
            vehicleScans: vehicleScanCount,
            incoming: 0,
            outgoing: 0
        });
    } catch (err) {
        console.error("❌ Stats Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 2. POST - Save vehicle scan log
router.post('/vehicle-scan', async (req, res) => {
    try {
        const logEntry = {
            ...req.body,
            _id: Date.now().toString(),
            type: 'VEHICLE_SCAN',
            createdAt: new Date(),
            timestamp: new Date().toISOString()
        };
        
        vehicleScanLogs.unshift(logEntry);
        
        // Keep only last 500 logs
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

// ✅ 3. GET all consolidated logs (Visitors + Panics + Vehicle Scans)
router.get('/all', async (req, res) => {
    try {
        // Get visitor logs - FIXED: Use correct field names
        const visitors = await Visitor.find()
            .sort({ entryTime: -1, createdAt: -1 })
            .limit(100);
        
        const formattedVisitors = visitors.map(v => ({ 
            type: 'VISITOR',
            id: v._id,
            name: v.visitorName || v.name || 'Unknown Visitor',
            details: formatDetails(v, 'VISITOR'),
            status: v.status || 'COMPLETED',
            timestamp: v.entryTime || v.createdAt,
            formattedTime: formatTimestamp(v.entryTime || v.createdAt),
            plateNumber: v.plateNumber || 'N/A',
            purpose: v.purpose || 'Visit',
            hostName: v.residentToVisit || 'Unknown'
        }));
        
        // Get panic alerts - FIXED: Use correct field names
        const panics = await Panic.find()
            .sort({ createdAt: -1 })
            .limit(100);
        
        const formattedPanics = panics.map(p => ({ 
            type: 'PANIC',
            id: p._id,
            name: p.residentName || p.name || 'Emergency Alert',
            details: formatDetails(p, 'PANIC'),
            status: p.status === 'Pending' ? 'ACTIVE' : 'RESOLVED',
            timestamp: p.createdAt,
            formattedTime: formatTimestamp(p.createdAt),
            latitude: p.location?.latitude,
            longitude: p.location?.longitude,
            houseNo: p.houseNo,
            blockLot: p.blockLot
        }));
        
        // Get vehicle scan logs
        const formattedVehicleScans = vehicleScanLogs.map(v => ({ 
            type: 'VEHICLE_SCAN',
            id: v._id || v.id,
            name: v.ownerName || 'Vehicle Owner',
            details: formatDetails(v, 'VEHICLE_SCAN'),
            status: v.status || 'APPROVED & AUTHORIZED',
            timestamp: v.scanTimestamp || v.timestamp || v.createdAt,
            formattedTime: formatTimestamp(new Date(v.scanTimestamp || v.timestamp || v.createdAt)),
            plateNumber: v.plateNumber,
            ownerName: v.ownerName,
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

        console.log(`📊 Fetched ${combinedLogs.length} logs (${formattedVisitors.length} visitors, ${formattedPanics.length} panics, ${formattedVehicleScans.length} vehicle scans)`);
        
        res.json(combinedLogs);
    } catch (err) {
        console.error("❌ Log Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 4. GET active panic alerts only
router.get('/panic/active', async (req, res) => {
    try {
        const activePanics = await Panic.find({ status: 'Pending' })
            .sort({ createdAt: -1 });
        
        const formattedActivePanics = activePanics.map(p => ({
            id: p._id,
            residentName: p.residentName,
            houseNo: p.houseNo,
            blockLot: p.blockLot,
            location: p.location,
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

// ✅ 5. GET vehicle scan logs only
router.get('/vehicle-scans', async (req, res) => {
    try {
        res.json(vehicleScanLogs);
    } catch (err) {
        console.error("❌ Vehicle Scans Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 6. GET recent logs (last 24 hours)
router.get('/recent', async (req, res) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const recentVisitors = await Visitor.find({
            entryTime: { $gte: twentyFourHoursAgo }
        }).sort({ entryTime: -1 });
        
        const recentPanics = await Panic.find({
            createdAt: { $gte: twentyFourHoursAgo }
        }).sort({ createdAt: -1 });
        
        const recentVehicleScans = vehicleScanLogs.filter(v => {
            const scanTime = new Date(v.scanTimestamp || v.timestamp || v.createdAt);
            return scanTime >= twentyFourHoursAgo;
        });
        
        let recentLogs = [
            ...recentVisitors.map(v => ({ type: 'VISITOR', name: v.visitorName, timestamp: v.entryTime, formattedTime: formatTimestamp(v.entryTime) })),
            ...recentPanics.map(p => ({ type: 'PANIC', name: p.residentName, timestamp: p.createdAt, formattedTime: formatTimestamp(p.createdAt) })),
            ...recentVehicleScans.map(v => ({ type: 'VEHICLE_SCAN', name: v.ownerName, timestamp: v.scanTimestamp, formattedTime: formatTimestamp(new Date(v.scanTimestamp)) }))
        ];
        
        recentLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(recentLogs);
    } catch (err) {
        console.error("❌ Recent Logs Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;