const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Payment = require('../models/paymentModel'); 
const auth = require('../middleware/authMiddleware'); 

// --- MULTER SETUP ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/payments'; 
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `receipt-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// --- 1. ADMIN: Add Bill ---
// Added protect and restrictTo so only Admins can create bills
router.post('/admin/add-bill', auth.protect, auth.restrictTo('admin'), async (req, res) => {
    try {
        const { userId, type, prevReading, currReading, month, dueDate } = req.body;
        
        let finalAmount = (type === 'Water') 
            ? (currReading - prevReading) * 25 
            : 500;

        const newPayment = new Payment({
            userId, 
            type, 
            month, 
            prevReading, 
            currReading,
            amount: finalAmount,
            dueDate,
            status: 'Unpaid'
        });

        await newPayment.save();
        res.status(201).json({ message: "Bill generated", amount: finalAmount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. ADMIN: View All Pending Payments ---
// This is for the Admin Dashboard to see who uploaded receipts
router.get('/admin/pending', auth.protect, auth.restrictTo('admin'), async (req, res) => {
    try {
        const pendingPayments = await Payment.find({ status: 'Pending' })
            .populate('userId', 'name blockLot mobileNumber');
        res.json(pendingPayments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. ADMIN: Verify/Approve Payment ---
// Admin clicks "Approve" after checking the receipt image
router.patch('/admin/verify/:billId', auth.protect, auth.restrictTo('admin'), async (req, res) => {
    try {
        const { status } = req.body; // 'Paid' or 'Rejected'
        const bill = await Payment.findByIdAndUpdate(
            req.params.billId, 
            { status: status }, 
            { new: true }
        );
        res.json({ message: `Payment marked as ${status}`, bill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. RESIDENT: Fetch My Bills ---
router.get('/my-bills', auth.protect, async (req, res) => {
    try {
        const bills = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(bills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 5. RESIDENT: Upload Receipt ---
router.post('/upload-receipt/:billId', auth.protect, upload.single('receipt'), async (req, res) => {
    try {
        const { transactionNo } = req.body;
        if (!req.file) return res.status(400).json({ error: "No receipt image uploaded" });

        const bill = await Payment.findById(req.params.billId);
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        bill.status = 'Pending';
        bill.transactionNo = transactionNo;
        bill.receiptImagePath = req.file.path; 
        
        await bill.save();
        res.json({ message: "Payment submitted for verification!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;