const express = require('express');
const router = express.Router();
const Visitor = require('../models/visitorModel'); 
const Panic = require('../models/panicModel');     

// GET /api/logs/all
router.get('/all', async (req, res) => {
    try {
        // Fetch data from both collections
        const visitors = await Visitor.find().sort({ createdAt: -1 }).limit(50);
        const panics = await Panic.find().sort({ createdAt: -1 }).limit(50);

        // Merge and format for the Flutter SecurityLogsScreen
        let combinedLogs = [
            ...visitors.map(v => ({ 
                type: 'VISITOR', 
                // ✅ Check multiple common field names to avoid "N/A"
                name: v.name || v.visitorName || v.fullName || 'Unknown Visitor', 
                status: v.status || 'IN', 
                timestamp: v.createdAt 
            })),
            ...panics.map(p => ({ 
                type: 'PANIC', 
                // ✅ Pull the resident name from the panic record
                name: p.name || p.residentName || 'Distress Signal', 
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