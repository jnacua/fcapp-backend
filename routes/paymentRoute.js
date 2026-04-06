const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/authMiddleware'); 
const paymentController = require('../controllers/paymentController');

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

// =========================================================
// ✅ PUBLIC ROUTES (PayMongo needs these to be open!)
// =========================================================
router.post('/webhook', paymentController.paymongoWebhook);
router.get('/success', paymentController.paymentSuccess);

// =========================================================
// ✅ PROTECTED ROUTES (Require Login)
// =========================================================
router.use(auth.protect);

// --- ADMIN ---
router.get('/all', auth.restrictTo('admin'), paymentController.getAll);
router.post(['/admin/add-bill', '/create-bill'], auth.restrictTo('admin'), paymentController.create);
router.put('/update-status/:id', auth.restrictTo('admin'), paymentController.updateStatus);
router.delete('/:id', auth.restrictTo('admin'), paymentController.deleteBill);

// --- RESIDENT ---
router.get('/my-bills', paymentController.getMyBills);
router.post('/paymongo-link', paymentController.createPayMongoLink);

// Manual Screenshot Upload
router.post('/upload-receipt/:billId', upload.single('receipt'), async (req, res) => {
    try {
        const { transactionNo } = req.body;
        if (!req.file) return res.status(400).json({ error: "No receipt image uploaded" });

        const Payment = require('../models/paymentModel');
        const bill = await Payment.findById(req.params.billId);
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        bill.status = 'PENDING';
        bill.transactionNo = transactionNo;
        bill.receiptImagePath = req.file.path.replace(/\\/g, "/"); 
        
        await bill.save();
        res.json({ message: "Payment submitted for verification!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;