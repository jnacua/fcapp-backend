const express = require('express');
const router = express.Router();
const Visitor = require('../models/visitorModel'); 
const Panic = require('../models/panicModel');     

// ✅ 1. NEW: Get Statistics for Dashboard Cards
// URL: /api/logs/security-stats
router.get('/security-stats', async (req, res) => {
    try {
        const visitorCount = await Visitor.countDocuments();
        // Count only active or pending panic alerts
        const panicCount = await Panic.countDocuments({ 
            status: { $in: ['ACTIVE', 'PENDING', 'Active'] } 
        });

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
                // ✅ Check all possible name fields to prevent "N/A"
                name: v.name || v.visitorName || v.fullName || 'Unknown Visitor', 
                status: v.status || 'IN', 
                timestamp: v.createdAt 
            })),
            ...panics.map(p => ({ 
                type: 'PANIC', 
                // ✅ Pull actual resident name or fallback to unit/emergency
                name: p.name || p.residentName || p.blockLot || 'Distress Signal', 
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