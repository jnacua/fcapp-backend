const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

const auth = require('../middleware/authMiddleware'); 
const paymentController = require('../controllers/paymentController');
const Payment = require('../models/paymentModel');

// ==========================================
// 0. CLOUDINARY CONFIGURATION
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const receiptStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'payment_receipts', 
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 1000, crop: 'limit' }] 
    },
});

const upload = multer({ storage: receiptStorage });

// =========================================================
// ✅ PUBLIC ROUTES
// =========================================================
router.post('/webhook', paymentController.paymongoWebhook);
router.get('/success', paymentController.paymentSuccess);

// =========================================================
// ✅ PROTECTED ROUTES (Require Login)
// =========================================================
router.use(auth.protect);

// --- ADMIN ONLY ---
router.get('/all', auth.restrictTo('ADMIN'), paymentController.getAll);

// Route for creating bills
router.post(
    ['/admin/add-bill', '/create-bill', '/create'], 
    auth.restrictTo('ADMIN'), 
    paymentController.create
);

// Send reminder email
router.post(
    '/send-reminder', 
    auth.restrictTo('ADMIN'), 
    paymentController.sendManualReminder
);

// Update payment status
router.put('/update-status/:id', auth.restrictTo('ADMIN'), paymentController.updateStatus);

// ✅ Soft delete (archive) a bill
router.delete('/:id', auth.restrictTo('ADMIN'), paymentController.deleteBill);

// ✅ Restore archived bill
router.put('/restore/:id', auth.restrictTo('ADMIN'), paymentController.restoreBill);

// ✅ Get archived bills
router.get('/archived', auth.restrictTo('ADMIN'), async (req, res) => {
    try {
        const archivedBills = await Payment.find({ isArchived: true }).sort({ createdAt: -1 });
        res.status(200).json(archivedBills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Get bills by user
router.get('/user/:userId', auth.restrictTo('ADMIN'), async (req, res) => {
    try {
        const bills = await Payment.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(bills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Get bill statistics (for dashboard)
router.get('/stats', auth.restrictTo('ADMIN'), async (req, res) => {
    try {
        const totalBills = await Payment.countDocuments();
        const paidBills = await Payment.countDocuments({ status: 'PAID' });
        const unpaidBills = await Payment.countDocuments({ status: 'UNPAID' });
        const pendingBills = await Payment.countDocuments({ status: 'PENDING' });
        
        const totalAmount = await Payment.aggregate([
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        
        const paidAmount = await Payment.aggregate([
            { $match: { status: 'PAID' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        
        const unpaidAmount = await Payment.aggregate([
            { $match: { status: 'UNPAID' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        
        res.status(200).json({
            totalBills,
            paidBills,
            unpaidBills,
            pendingBills,
            totalAmount: totalAmount[0]?.total || 0,
            paidAmount: paidAmount[0]?.total || 0,
            unpaidAmount: unpaidAmount[0]?.total || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- RESIDENT & ADMIN ---
router.get('/my-bills', paymentController.getMyBills);
router.post('/paymongo-link', paymentController.createPayMongoLink);

// ✅ UPDATED: Manual receipt uploads now use CLOUDINARY
router.post('/upload-receipt/:billId', upload.single('receipt'), async (req, res) => {
    try {
        const { transactionNo } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: "No receipt image uploaded" });
        }

        const bill = await Payment.findById(req.params.billId);
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        bill.status = 'PENDING';
        bill.transactionNo = transactionNo;
        bill.receiptImagePath = req.file.path; 
        
        await bill.save();
        console.log("✅ Receipt uploaded to Cloudinary:", bill.receiptImagePath);
        
        res.json({ message: "Payment submitted for verification!", data: bill });
    } catch (err) {
        console.error("❌ Receipt Upload Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;