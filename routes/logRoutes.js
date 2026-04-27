const express = require('express');
const router = express.Router();
const Visitor = require('../models/visitorModel'); 
const Panic = require('../models/panicModel');     // Make sure this matches your model export name

// In-memory storage for vehicle scans (no database model needed)
let vehicleScanLogs = [];

// Helper function to format timestamp for display
function formatTimestamp(date) {
    if (!date) return '--:-- --';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '--:-- --';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let hour = d.getHours();
        const minute = d.getMinutes().toString().padStart(2, '0');
        const period = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} - ${hour}:${minute} ${period}`;
    } catch (e) {
        return date.toString();
    }
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
        // Try multiple possible location fields
        const location = log.blockLot || log.houseNo || log.userId?.blockLot || 'Unknown Location';
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

// ✅ 1. POST - Save vehicle scan log (in-memory)
router.post('/vehicle-scan', async (req, res) => {
    try {
        console.log("📝 Vehicle scan request received:", req.body);
        
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
        console.log(`📊 Total vehicle scans: ${vehicleScanLogs.length}`);
        
        res.status(201).json({ success: true, log: logEntry });
    } catch (err) {
        console.error("❌ Vehicle scan log error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 2. Get Statistics for Dashboard Cards
router.get('/security-stats', async (req, res) => {
    try {
        console.log("📊 Fetching security stats...");
        
        // Count visitors
        const visitorCount = await Visitor.countDocuments();
        
        // Count active panics (Pending status)
        const activePanicCount = await Panic.countDocuments({ status: 'Pending' });
        
        // Count total panics
        const totalPanicCount = await Panic.countDocuments();
        
        // Count vehicle scans from memory
        const vehicleScanCount = vehicleScanLogs.length;
        
        // Get today's visitors
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const visitorsToday = await Visitor.countDocuments({
            entryTime: { $gte: today, $lt: tomorrow }
        });

        console.log(`📊 Stats: Visitors(${visitorCount}) | Visitors Today(${visitorsToday}) | Active Panics(${activePanicCount}) | Total Panics(${totalPanicCount}) | Vehicle Scans(${vehicleScanCount})`);

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
        console.error("Stack:", err.stack);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 3. GET all consolidated logs (Visitors + Panics + Vehicle Scans)
router.get('/all', async (req, res) => {
    try {
        console.log("📊 Fetching all consolidated logs...");
        
        // Get visitor logs
        const visitors = await Visitor.find()
            .sort({ entryTime: -1, createdAt: -1 })
            .limit(100);
        
        console.log(`📊 Found ${visitors.length} visitor logs`);
        
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
        
        // Get panic alerts - use the correct model name
        console.log("📊 Fetching panic alerts...");
        const panics = await Panic.find()
            .sort({ createdAt: -1 })
            .limit(100);
        
        console.log(`📊 Found ${panics.length} panic logs`);
        
        // Log first panic for debugging
        if (panics.length > 0) {
            console.log("📊 Sample panic:", {
                id: panics[0]._id,
                residentName: panics[0].residentName,
                blockLot: panics[0].blockLot,
                status: panics[0].status,
                createdAt: panics[0].createdAt
            });
        }
        
        const formattedPanics = panics.map(p => ({ 
            type: 'PANIC',
            id: p._id,
            name: p.residentName || p.name || 'Emergency Alert',
            details: formatDetails(p, 'PANIC'),
            status: p.status === 'Pending' ? 'ACTIVE' : (p.status === 'Resolved' ? 'RESOLVED' : p.status),
            timestamp: p.createdAt,
            formattedTime: formatTimestamp(p.createdAt),
            latitude: p.location?.latitude,
            longitude: p.location?.longitude,
            houseNo: p.houseNo || 'N/A',
            blockLot: p.blockLot || 'N/A',
            emergencyType: p.emergencyType || 'Emergency Alert'
        }));
        
        // Get vehicle scan logs from memory
        const formattedVehicleScans = vehicleScanLogs.map(v => ({ 
            type: 'VEHICLE',
            id: v._id || v.id,
            name: v.ownerName || 'Vehicle Owner',
            details: formatDetails(v, 'VEHICLE_SCAN'),
            status: v.status || 'APPROVED & AUTHORIZED',
            timestamp: v.scanTimestamp || v.timestamp || v.createdAt,
            formattedTime: formatTimestamp(v.scanTimestamp || v.timestamp || v.createdAt),
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

        console.log(`📊 Total logs: ${combinedLogs.length} (Visitors: ${formattedVisitors.length}, Panics: ${formattedPanics.length}, Vehicles: ${formattedVehicleScans.length})`);
        
        res.json(combinedLogs);
    } catch (err) {
        console.error("❌ Log Route Error:", err.message);
        console.error("Stack:", err.stack);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 4. GET active panic alerts only
router.get('/panic/active', async (req, res) => {
    try {
        const activePanics = await Panic.find({ status: 'Pending' })
            .sort({ createdAt: -1 });
        
        console.log(`📊 Found ${activePanics.length} active panics`);
        
        const formattedActivePanics = activePanics.map(p => ({
            id: p._id,
            residentName: p.residentName,
            name: p.residentName,
            houseNo: p.houseNo || 'N/A',
            blockLot: p.blockLot || 'N/A',
            location: p.location,
            emergencyType: p.emergencyType,
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
            ...recentVisitors.map(v => ({ 
                type: 'VISITOR', 
                name: v.visitorName, 
                timestamp: v.entryTime, 
                formattedTime: formatTimestamp(v.entryTime) 
            })),
            ...recentPanics.map(p => ({ 
                type: 'PANIC', 
                name: p.residentName, 
                timestamp: p.createdAt, 
                formattedTime: formatTimestamp(p.createdAt),
                blockLot: p.blockLot,
                emergencyType: p.emergencyType
            })),
            ...recentVehicleScans.map(v => ({ 
                type: 'VEHICLE_SCAN', 
                name: v.ownerName, 
                timestamp: v.scanTimestamp, 
                formattedTime: formatTimestamp(v.scanTimestamp) 
            }))
        ];
        
        recentLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(recentLogs);
    } catch (err) {
        console.error("❌ Recent Logs Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 7. Debug endpoint to check panic collection
router.get('/debug/panics', async (req, res) => {
    try {
        const allPanics = await Panic.find().sort({ createdAt: -1 });
        console.log(`🔍 Debug: Found ${allPanics.length} panics in database`);
        
        res.json({
            success: true,
            count: allPanics.length,
            panics: allPanics.map(p => ({
                id: p._id,
                residentName: p.residentName,
                blockLot: p.blockLot,
                houseNo: p.houseNo,
                emergencyType: p.emergencyType,
                status: p.status,
                createdAt: p.createdAt,
                formattedTime: formatTimestamp(p.createdAt)
            }))
        });
    } catch (err) {
        console.error("❌ Debug Panics Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;