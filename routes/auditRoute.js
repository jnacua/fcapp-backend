const express = require('express'); 
const router = express.Router(); 
const Audit = require('../models/auditModel'); 
const { protect, restrictTo } = require('../middleware/authMiddleware'); 

// GET all logs
// Updated to accept both 'ADMIN' and 'admin' just in case
router.get('/', protect, restrictTo('ADMIN', 'admin'), async (req, res) => { 
    try { 
        const logs = await Audit.find().sort({ timestamp: -1 }); 
        
        // 🚀 DEBUG LOG: Check your Render console for this!
        console.log(`Audit requested by ${req.user.name}. Entries found: ${logs.length}`);
        
        res.status(200).json(logs); 
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    } 
}); 

module.exports = router;