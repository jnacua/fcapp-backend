const express = require('express');
const router = express.Router();
const BlockLot = require('../models/blockLotModel');

console.log("✅ blockLotRoute.js loaded successfully!");

// ==================== GET ALL BLOCKS/LOTS ====================
router.get('/blocks/all', async (req, res) => {
    try {
        const allLots = await BlockLot.find().sort({ blockNumber: 1, lotNumber: 1 });
        
        const groupedByBlock = {};
        allLots.forEach(lot => {
            const blockNum = lot.blockNumber;
            if (!groupedByBlock[blockNum]) {
                groupedByBlock[blockNum] = {
                    _id: blockNum,
                    name: `Block ${blockNum}`,
                    lots: []
                };
            }
            groupedByBlock[blockNum].lots.push({
                _id: lot._id,
                lotNumber: lot.lotNumber,
                fullAddress: lot.fullAddress,
                isOccupied: lot.isOccupied,
                occupantId: lot.occupantId,
                occupantName: lot.occupantName,
                status: lot.isOccupied ? 'occupied' : 'available'
            });
        });
        
        const blocks = Object.values(groupedByBlock);
        res.status(200).json(blocks);
    } catch (err) {
        console.error("Error fetching all blocks/lots:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== ADD NEW BLOCK ====================
router.post('/blocks/add', async (req, res) => {
    try {
        const { blockNumber, numberOfLots } = req.body;
        
        if (!blockNumber || !numberOfLots) {
            return res.status(400).json({ error: "Block number and number of lots required" });
        }
        
        const existingBlock = await BlockLot.findOne({ blockNumber: blockNumber.toString() });
        if (existingBlock) {
            return res.status(400).json({ error: "Block already exists" });
        }
        
        const newLots = [];
        for (let lot = 1; lot <= numberOfLots; lot++) {
            newLots.push({
                blockNumber: blockNumber.toString(),
                lotNumber: lot.toString(),
                fullAddress: `Block ${blockNumber}, Lot ${lot}`,
                isOccupied: false
            });
        }
        
        await BlockLot.insertMany(newLots);
        
        res.status(201).json({
            success: true,
            message: `Block ${blockNumber} with ${numberOfLots} lots created successfully`
        });
    } catch (err) {
        console.error("Error adding block:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== ADD NEW LOT ====================
router.post('/lots/add', async (req, res) => {
    try {
        const { blockNumber, lotNumber } = req.body;
        
        if (!blockNumber || !lotNumber) {
            return res.status(400).json({ error: "Block number and lot number required" });
        }
        
        const existingLot = await BlockLot.findOne({ 
            blockNumber: blockNumber.toString(), 
            lotNumber: lotNumber.toString() 
        });
        
        if (existingLot) {
            return res.status(400).json({ error: "Lot already exists in this block" });
        }
        
        const newLot = new BlockLot({
            blockNumber: blockNumber.toString(),
            lotNumber: lotNumber.toString(),
            fullAddress: `Block ${blockNumber}, Lot ${lotNumber}`,
            isOccupied: false
        });
        
        await newLot.save();
        
        res.status(201).json({
            success: true,
            message: `Lot ${lotNumber} added to Block ${blockNumber} successfully`
        });
    } catch (err) {
        console.error("Error adding lot:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== DELETE BLOCK ====================
router.delete('/blocks/delete/:blockNumber', async (req, res) => {
    try {
        const { blockNumber } = req.params;
        
        const result = await BlockLot.deleteMany({ blockNumber: blockNumber });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Block not found" });
        }
        
        res.status(200).json({
            success: true,
            message: `Block ${blockNumber} deleted successfully`
        });
    } catch (err) {
        console.error("Error deleting block:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== DELETE LOT ====================
router.delete('/lots/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedLot = await BlockLot.findByIdAndDelete(id);
        
        if (!deletedLot) {
            return res.status(404).json({ error: "Lot not found" });
        }
        
        res.status(200).json({
            success: true,
            message: `Lot deleted successfully`
        });
    } catch (err) {
        console.error("Error deleting lot:", err);
        res.status(500).json({ error: err.message });
    }
});

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