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

// ✅ FIXED: Route for sending manual email reminders
// If your controller method isn't working, this logic ensures the email sends
router.post(
    '/send-reminder', 
    auth.restrictTo('ADMIN'), 
    async (req, res) => {
        try {
            const { email, householdName, amount, month, type } = req.body;

            if (!email) return res.status(400).json({ message: "Resident email is required" });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: `Payment Reminder: Unpaid ${type} for ${month}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                        <h2 style="color: #176F63;">FCAPP Payment Reminder</h2>
                        <p>Hello <b>${householdName}</b>,</p>
                        <p>This is a friendly reminder regarding your unpaid <b>${type}</b> for the month of <b>${month}</b>.</p>
                        <p style="font-size: 18px;">Amount Due: <span style="color: red; font-weight: bold;">₱${amount}</span></p>
                        <p>Please settle this balance through the mobile app at your earliest convenience.</p>
                        <br>
                        <p>Thank you,<br>Homeowners Association Admin</p>
                    </div>
                `
            };

            // Use the transporter attached to the request by your app.js
            await req.transporter.sendMail(mailOptions);

            res.status(200).json({ message: "Reminder email sent successfully!" });
        } catch (err) {
            console.error("❌ Reminder Error:", err.message);
            res.status(500).json({ error: "Failed to send email reminder" });
        }
    }
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