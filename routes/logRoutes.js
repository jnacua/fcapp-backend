const express = require('express');
const router = express.Router();
const Visitor = require('../models/visitorModel'); // Check if it's visitorModel.js or just visitor.js
const Panic = require('../models/panicModel');     // Check if it's panicModel.js or just panic.js

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
                name: v.name, 
                status: v.status || 'IN', 
                timestamp: v.createdAt 
            })),
            ...panics.map(p => ({ 
                type: 'PANIC', 
                name: p.name || 'Emergency Alert', 
                status: p.status || 'ACTIVE', 
                timestamp: p.createdAt 
            }))
        ];

        // Sort by newest date
        combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(combinedLogs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;