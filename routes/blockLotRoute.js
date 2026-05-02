const express = require('express');
const router = express.Router();
const BlockLot = require('../models/blockLotModel');

// GET all available (unoccupied) blocks/lots
router.get('/available', async (req, res) => {
    try {
        const availableLots = await BlockLot.find({ isOccupied: false })
            .sort({ blockNumber: 1, lotNumber: 1 });
        res.status(200).json(availableLots);
    } catch (err) {
        console.error("Error fetching available lots:", err);
        res.status(500).json({ error: err.message });
    }
});

// Initialize all blocks and lots (630 lots)
router.post('/initialize', async (req, res) => {
    try {
        await BlockLot.deleteMany({});
        
        const allBlockLots = [];

        // Blocks 1-31: 18 lots each
        for (let block = 1; block <= 31; block++) {
            for (let lot = 1; lot <= 18; lot++) {
                allBlockLots.push({
                    blockNumber: block.toString(),
                    lotNumber: lot.toString(),
                    fullAddress: `Block ${block}, Lot ${lot}`,
                    isOccupied: false
                });
            }
        }

        // Blocks 32-36: 14 lots each
        for (let block = 32; block <= 36; block++) {
            for (let lot = 1; lot <= 14; lot++) {
                allBlockLots.push({
                    blockNumber: block.toString(),
                    lotNumber: lot.toString(),
                    fullAddress: `Block ${block}, Lot ${lot}`,
                    isOccupied: false
                });
            }
        }
        
        await BlockLot.insertMany(allBlockLots);
        
        res.status(201).json({
            success: true,
            message: `Created ${allBlockLots.length} block/lot combinations`,
            totalLots: allBlockLots.length
        });
    } catch (err) {
        console.error("Error initializing block lots:", err);
        res.status(500).json({ error: err.message });
    }
});

// Check if a specific block/lot is available
router.get('/check/:block/:lot', async (req, res) => {
    try {
        const { block, lot } = req.params;
        const blockLot = await BlockLot.findOne({ blockNumber: block, lotNumber: lot });
        
        if (!blockLot) {
            return res.status(404).json({ 
                available: false, 
                message: "Invalid block/lot combination" 
            });
        }
        
        res.status(200).json({ 
            available: !blockLot.isOccupied,
            occupiedBy: blockLot.occupantName
        });
    } catch (err) {
        console.error("Error checking block/lot:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;