const express = require('express');
const router = express.Router();
const Visitor = require('../models/visitorModel'); 
const Panic = require('../models/panicModel');     

// ✅ 1. Get Statistics for Dashboard Cards
// URL: /api/logs/security-stats
router.get('/security-stats', async (req, res) => {
    try {
        // Count all visitors in the database
        const visitorCount = await Visitor.countDocuments();
        
        // Count ALL panic documents regardless of status 
        // (This prevents the '0' issue if statuses don't match exactly)
        const panicCount = await Panic.countDocuments();

        // Log to Render console for debugging
        console.log(`📊 Stats Sync: Visitors(${visitorCount}) | Panics(${panicCount})`);

        res.json({
            visitors: visitorCount,
            panics: panicCount
        });
    } catch (err) {
        console.error("❌ Stats Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 2. GET all consolidated logs (Visitors + Panics)
// URL: /api/logs/all
router.get('/all', async (req, res) => {
    try {
        const visitors = await Visitor.find().sort({ createdAt: -1 }).limit(50);
        const panics = await Panic.find().sort({ createdAt: -1 }).limit(50);

        let combinedLogs = [
            ...visitors.map(v => ({ 
                type: 'VISITOR', 
                // ✅ Expanded name check: tries every common field name
                name: v.name || v.visitorName || v.fullName || v.visitor_name || 'Unknown Visitor', 
                status: v.status || 'IN', 
                timestamp: v.createdAt 
            })),
            ...panics.map(p => ({ 
                type: 'PANIC', 
                // ✅ Expanded name check: pulls resident info or location
                name: p.name || p.residentName || p.resident_name || p.blockLot || 'Emergency Alert', 
                status: p.status || 'ACTIVE', 
                timestamp: p.createdAt 
            }))
        ];

        // Sort by newest date (Descending)
        combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(combinedLogs);
    } catch (err) {
        console.error("❌ Log Route Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;