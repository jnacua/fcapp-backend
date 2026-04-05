const express = require('express');
const router = express.Router();
const axios = require('axios');
const Payment = require('../models/paymentModel'); // Your payment model
const { protect } = require('../middleware/authMiddleware');

// ================= 1. CREATE CHECKOUT SESSION =================
router.post('/create-checkout', protect, async (req, res) => {
    try {
        const { amount, description, billId } = req.body;

        const options = {
            method: 'POST',
            url: 'https://api.paymongo.com/v1/checkout_sessions',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                // Make sure PAYMONGO_SECRET_KEY is in your .env
                authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
            },
            data: {
                data: {
                    attributes: {
                        send_email_receipt: true,
                        show_description: true,
                        line_items: [{
                            currency: 'PHP',
                            amount: Math.round(amount * 100), // Convert to centavos
                            description: description,
                            name: description,
                            quantity: 1
                        }],
                        payment_method_types: ['gcash', 'paymaya', 'card', 'grab_pay'],
                        description: `Bill ID: ${billId}`,
                        // Metadata helps identify which bill to update later
                        metadata: { billId: billId } 
                    }
                }
            }
        };

        const response = await axios.request(options);
        res.status(200).json({ checkout_url: response.data.data.attributes.checkout_url });
    } catch (err) {
        console.error("PayMongo Error:", err.response ? err.response.data : err.message);
        res.status(500).json({ message: "Failed to initialize payment" });
    }
});

// ================= 2. WEBHOOK (AUTOMATIC UPDATE) =================
// This is the URL you will give to PayMongo Dashboard: 
// https://your-app.onrender.com/api/paymongo/webhook
router.post('/webhook', async (req, res) => {
    const event = req.body.data.attributes;
    const type = req.body.data.type;

    if (type === 'checkout_session.payment.paid') {
        const billId = event.data.attributes.metadata.billId;
        const amountPaid = event.data.attributes.amount / 100;

        try {
            // Update the payment status in your MongoDB
            await Payment.findByIdAndUpdate(billId, {
                status: 'PAID',
                totalPaid: amountPaid,
                method: event.data.attributes.payment_option.toUpperCase()
            });
            console.log(`✅ Bill ${billId} marked as PAID via Webhook`);
        } catch (err) {
            console.error("Webhook DB Update Error:", err);
        }
    }

    res.status(200).send("Event Received");
});

module.exports = router;