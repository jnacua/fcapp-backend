const express = require('express');
const router = express.Router();
const BlockLot = require('../models/blockLotModel');

console.log("✅ blockLotRoute.js loaded successfully!");

// ==================== GET ALL BLOCKS/LOTS (NEW) ====================
router.get('/all', async (req, res) => {
    try {
        const allLots = await BlockLot.find()
            .sort({ blockNumber: 1, lotNumber: 1 });
        
        // Group by block number
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
        
        // Convert to array
        const blocks = Object.values(groupedByBlock);
        res.status(200).json(blocks);
    } catch (err) {
        console.error("Error fetching all blocks/lots:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== GET ALL OCCUPIED BLOCKS/LOTS ====================
router.get('/occupied', async (req, res) => {
    try {
        const occupiedLots = await BlockLot.find({ isOccupied: true })
            .populate('occupantId', 'name email')
            .sort({ blockNumber: 1, lotNumber: 1 });
        res.status(200).json(occupiedLots);
    } catch (err) {
        console.error("Error fetching occupied lots:", err);
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

// ==================== ADD NEW BLOCK (with lots) ====================
router.post('/block/add', async (req, res) => {
    try {
        const { blockNumber, numberOfLots } = req.body;
        
        if (!blockNumber || !numberOfLots) {
            return res.status(400).json({ error: "Block number and number of lots required" });
        }
        
        // Check if block already exists
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
            message: `Block ${blockNumber} with ${numberOfLots} lots created successfully`,
            lotsCreated: newLots.length
        });
    } catch (err) {
        console.error("Error adding block:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== ADD NEW LOT TO EXISTING BLOCK ====================
router.post('/lot/add', async (req, res) => {
    try {
        const { blockNumber, lotNumber } = req.body;
        
        if (!blockNumber || !lotNumber) {
            return res.status(400).json({ error: "Block number and lot number required" });
        }
        
        // Check if lot already exists
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
            message: `Lot ${lotNumber} added to Block ${blockNumber} successfully`,
            lot: newLot
        });
    } catch (err) {
        console.error("Error adding lot:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== DELETE A BLOCK (all lots in that block) ====================
router.delete('/block/delete/:blockNumber', async (req, res) => {
    try {
        const { blockNumber } = req.params;
        
        const result = await BlockLot.deleteMany({ blockNumber: blockNumber });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Block not found" });
        }
        
        res.status(200).json({
            success: true,
            message: `Block ${blockNumber} and all its lots deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error("Error deleting block:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== DELETE A SPECIFIC LOT ====================
router.delete('/lot/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedLot = await BlockLot.findByIdAndDelete(id);
        
        if (!deletedLot) {
            return res.status(404).json({ error: "Lot not found" });
        }
        
        res.status(200).json({
            success: true,
            message: `Lot ${deletedLot.lotNumber} from Block ${deletedLot.blockNumber} deleted successfully`
        });
    } catch (err) {
        console.error("Error deleting lot:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== ASSIGN RESIDENT TO A LOT ====================
router.put('/assign/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { occupantId, occupantName } = req.body;
        
        const updatedLot = await BlockLot.findByIdAndUpdate(
            id,
            {
                isOccupied: true,
                occupantId: occupantId,
                occupantName: occupantName
            },
            { new: true }
        );
        
        if (!updatedLot) {
            return res.status(404).json({ error: "Lot not found" });
        }
        
        res.status(200).json({
            success: true,
            message: `Lot ${updatedLot.lotNumber} assigned successfully`,
            lot: updatedLot
        });
    } catch (err) {
        console.error("Error assigning lot:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== VACATE A LOT ====================
router.put('/vacate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const updatedLot = await BlockLot.findByIdAndUpdate(
            id,
            {
                isOccupied: false,
                occupantId: null,
                occupantName: ''
            },
            { new: true }
        );
        
        if (!updatedLot) {
            return res.status(404).json({ error: "Lot not found" });
        }
        
        res.status(200).json({
            success: true,
            message: `Lot ${updatedLot.lotNumber} vacated successfully`,
            lot: updatedLot
        });
    } catch (err) {
        console.error("Error vacating lot:", err);
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

module.exports = router;