const express = require('express'); 
const router = express.Router(); 
const Audit = require('../models/auditModel'); 
const { protect, restrictTo } = require('../middleware/authMiddleware'); 

// GET all logs with filtering
router.get('/', protect, restrictTo('ADMIN', 'admin'), async (req, res) => { 
    try { 
        const { 
            page = 1, 
            limit = 50, 
            action, 
            entity, 
            userId,
            startDate,
            endDate,
            search
        } = req.query;
        
        let query = {};
        
        if (action) query.action = action;
        if (entity) query.entity = entity;
        if (userId) query.userId = userId;
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        if (search) {
            query.$or = [
                { userName: { $regex: search, $options: 'i' } },
                { entityName: { $regex: search, $options: 'i' } },
                { details: { $regex: search, $options: 'i' } }
            ];
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [logs, total] = await Promise.all([
            Audit.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'name email'),
            Audit.countDocuments(query)
        ]);
        
        console.log(`Audit requested by ${req.user.name}. Entries found: ${logs.length}`);
        
        res.status(200).json({ 
            logs, 
            total, 
            page: parseInt(page), 
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        }); 
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    } 
});

// POST endpoint for frontend to log audits
router.post('/log', protect, restrictTo('ADMIN', 'admin'), async (req, res) => {
    try {
        const { action, entity, entityId, entityName, details } = req.body;
        
        // Get client IP address
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] 
            || req.socket.remoteAddress 
            || req.ip 
            || 'unknown';
        
        // Get user agent
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        const auditLog = new Audit({
            userId: req.user.id,
            userName: req.user.name,
            userRole: req.user.role,
            action: action,
            entity: entity,
            entityId: entityId,
            entityName: entityName,
            details: details,
            ipAddress: ipAddress,
            userAgent: userAgent,
            status: 'SUCCESS',
            timestamp: new Date()
        });
        
        await auditLog.save();
        console.log(`✅ Audit logged: ${action} ${entity} by ${req.user.name}`);
        
        res.status(200).json({ 
            success: true, 
            message: 'Audit logged successfully',
            auditId: auditLog._id
        });
    } catch (err) {
        console.error("Audit log error:", err);
        res.status(500).json({ message: err.message });
    }
});

// POST endpoint for failed operations
router.post('/log-failed', protect, restrictTo('ADMIN', 'admin'), async (req, res) => {
    try {
        const { action, entity, details } = req.body;
        
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] 
            || req.socket.remoteAddress 
            || req.ip 
            || 'unknown';
        
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        const auditLog = new Audit({
            userId: req.user.id,
            userName: req.user.name,
            userRole: req.user.role,
            action: action,
            entity: entity,
            details: `FAILED: ${details}`,
            ipAddress: ipAddress,
            userAgent: userAgent,
            status: 'FAILED',
            timestamp: new Date()
        });
        
        await auditLog.save();
        console.log(`❌ Failed audit logged: ${action} ${entity} by ${req.user.name}`);
        
        res.status(200).json({ 
            success: true, 
            message: 'Failed audit logged successfully'
        });
    } catch (err) {
        console.error("Failed audit log error:", err);
        res.status(500).json({ message: err.message });
    }
});

// GET audit statistics
router.get('/stats', protect, restrictTo('ADMIN', 'admin'), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [totalLogs, todayLogs, actionStats, entityStats] = await Promise.all([
            Audit.countDocuments(),
            Audit.countDocuments({ timestamp: { $gte: today } }),
            Audit.aggregate([
                { $group: { _id: "$action", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Audit.aggregate([
                { $group: { _id: "$entity", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);
        
        res.json({ totalLogs, todayLogs, actionStats, entityStats });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET logs by entity
router.get('/entity/:entity', protect, restrictTo('ADMIN', 'admin'), async (req, res) => {
    try {
        const { entity } = req.params;
        const logs = await Audit.find({ entity })
            .sort({ timestamp: -1 })
            .limit(100)
            .populate('userId', 'name');
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET logs by user
router.get('/user/:userId', protect, restrictTo('ADMIN', 'admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const logs = await Audit.find({ userId })
            .sort({ timestamp: -1 })
            .limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;