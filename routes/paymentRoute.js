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

// --- 1. ADMIN: Fetch ALL Payments (CRITICAL FIX) ---
// ✅ ADDED: This fixes the 404 error when Flutter calls /api/payments/all
router.get('/all', auth.protect, auth.restrictTo('admin'), async (req, res) => {
    try {
        const payments = await Payment.find().sort({ createdAt: -1 });
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. ADMIN: Add Bill (Generate Bill) ---
// ✅ UPDATED: Added 'userName' so the Flutter Table shows names instead of N/A
router.post('/admin/add-bill', auth.protect, auth.restrictTo('admin'), async (req, res) => {
    try {
        const { userId, userName, type, prevReading, currReading, month, dueDate, amount } = req.body;
        
        // Auto-calculate Water, otherwise use the amount passed from Monthly Dues dialog
        let finalAmount = amount;
        if (type === 'Water' || type === 'Water Bill') {
            finalAmount = (currReading - prevReading) * 25;
        }

        const newPayment = new Payment({
            userId, 
            userName: userName || "Resident", // ✅ Saved to DB for the table view
            type, 
            month, 
            prevReading: prevReading || 0, 
            currReading: currReading || 0,
            amount: finalAmount,
            dueDate: dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            status: 'UNPAID' // Standardized to Uppercase for Flutter UI
        });

        await newPayment.save();
        res.status(201).json({ message: "Bill generated", bill: newPayment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. ADMIN: View Pending (For Receipts) ---
router.get('/admin/pending', auth.protect, auth.restrictTo('admin'), async (req, res) => {
    try {
        const pendingPayments = await Payment.find({ status: 'PENDING' })
            .populate('userId', 'name blockLot mobileNumber');
        res.json(pendingPayments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. ADMIN: Verify/Approve Payment ---
router.patch('/admin/verify/:billId', auth.protect, auth.restrictTo('admin'), async (req, res) => {
    try {
        const { status } = req.body; // 'PAID' or 'REJECTED'
        const bill = await Payment.findByIdAndUpdate(
            req.params.billId, 
            { status: status.toUpperCase() }, 
            { new: true }
        );
        res.json({ message: `Payment marked as ${status}`, bill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 5. ADMIN: Delete Bill ---
// ✅ ADDED: For the Trash icon in your Flutter table
router.delete('/:id', auth.protect, auth.restrictTo('admin'), async (req, res) => {
    try {
        await Payment.findByIdAndDelete(req.params.id);
        res.json({ message: "Bill deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 6. RESIDENT: Fetch My Bills ---
router.get('/my-bills', auth.protect, async (req, res) => {
    try {
        const bills = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(bills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 7. RESIDENT: Upload Receipt ---
router.post('/upload-receipt/:billId', auth.protect, upload.single('receipt'), async (req, res) => {
    try {
        const { transactionNo } = req.body;
        if (!req.file) return res.status(400).json({ error: "No receipt image uploaded" });

        const bill = await Payment.findById(req.params.billId);
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        bill.status = 'PENDING';
        bill.transactionNo = transactionNo;
        bill.receiptImagePath = req.file.path.replace(/\\/g, "/"); // Fix Windows path slashes
        
        await bill.save();
        res.json({ message: "Payment submitted for verification!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;