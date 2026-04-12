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

// ✅ ENHANCED: Route for sending manual email reminders
router.post(
    '/send-reminder', 
    auth.restrictTo('ADMIN'), 
    async (req, res) => {
        try {
            const { email, householdName, amount, month, type } = req.body;

            console.log(`📩 Preparing reminder for: ${email}`);

            if (!email || email === "N/A") {
                return res.status(400).json({ error: "Resident email is required or invalid" });
            }

            // Check if transporter was attached in server.js
            if (!req.transporter) {
                console.error("❌ ERROR: Email Transporter not found on request object.");
                return res.status(500).json({ error: "Email service is not configured on the server." });
            }

            const mailOptions = {
                // ✅ CRITICAL: This must be the GMAIL address you VERIFIED in Brevo
                from: `"FCAPP Admin" <jeianpaolonacua07@gmail.com>`, 
                to: email,
                subject: `Payment Reminder: ${type} - ${month}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; max-width: 600px;">
                        <h2 style="color: #176F63;">Payment Reminder</h2>
                        <p>Hello <b>${householdName}</b>,</p>
                        <p>This is a friendly reminder regarding your unpaid <b>${type}</b> for the month of <b>${month}</b>.</p>
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <span style="font-size: 18px;">Total Amount Due: </span>
                            <span style="font-size: 22px; color: #d9534f; font-weight: bold;">₱${amount}</span>
                        </div>
                        <p>Please settle this balance through the mobile app at your earliest convenience.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #888;">This is an automated message from the Homeowners Association Management System.</p>
                    </div>
                `
            };

            // Attempt to send email
            await req.transporter.sendMail(mailOptions);
            console.log(`✅ Email successfully sent to ${email}`);

            res.status(200).json({ message: "Reminder email sent successfully!" });
        } catch (err) {
            console.error("❌ MAIL ERROR:", err.message);
            
            // Check for specific Brevo/SMTP errors
            if (err.message.includes('rejected') || err.message.includes('sender')) {
                return res.status(500).json({ error: "Sender email not verified in Brevo." });
            }

            res.status(500).json({ error: "Failed to send email. Check Render logs for details." });
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