const express = require('express'); 
const router = express.Router(); 
const Audit = require('../models/auditModel'); 
const { protect, restrictTo } = require('../middleware/authMiddleware'); 
 
router.get('/', protect, restrictTo('ADMIN'), async (req, res) => { 
    try { 
        const logs = await Audit.find().sort({ timestamp: -1 }); 
        res.status(200).json(logs); 
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    } 
}); 
 
module.exports = router; 
