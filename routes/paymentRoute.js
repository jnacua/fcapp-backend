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

// ✅ FIXED: Route now points directly to our Bulletproof Controller!
router.post(
    '/send-reminder', 
    auth.restrictTo('ADMIN'), 
    paymentController.sendManualReminder
);

router.put('/update-status/:id', auth.restrictTo('ADMIN'), paymentController.updateStatus);
router.delete('/:id', auth.restrictTo('ADMIN'), paymentController.deleteBill);

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
        // ✅ Store the permanent Cloudinary HTTPS URL
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