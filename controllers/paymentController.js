const Payment = require('../models/paymentModel');
const axios = require('axios');

// ✅ 1. Get ALL payments (Admin view)
exports.getAll = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.status(200).json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ 2. Create a Bill (Admin)
exports.create = async (req, res) => {
  try {
    const { 
      userId, userName, amount, type, month, 
      prevReading, currReading, ratePerCubic, dueDate 
    } = req.body;

    if (!userId) return res.status(400).json({ message: "User ID is required" });

    let finalAmount = amount || 0;
    if (type === 'Water' || type === 'Water Bill') {
       const consumption = (Number(currReading) || 0) - (Number(prevReading) || 0);
       const rate = Number(ratePerCubic) || 25;
       finalAmount = consumption * rate;
    }

    const newPayment = new Payment({
      userId,
      userName: userName || "Resident", 
      type: type || "Monthly Dues",      
      amount: finalAmount,
      month: month || new Date().toLocaleString('default', { month: 'long' }), 
      prevReading: prevReading || 0,
      currReading: currReading || 0,
      ratePerCubic: ratePerCubic || 25,
      status: 'UNPAID',
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    });

    await newPayment.save();
    res.status(201).json(newPayment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ 3. Get payments for a specific Resident
exports.getMyBills = async (req, res) => {
  try {
    const bills = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bills', error: err.message });
  }
};

// ✅ 4. Update payment status (Manual Admin Update)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionNo } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      id,
      { 
        status: status ? status.toUpperCase() : 'UNPAID', 
        transactionNo: transactionNo 
      },
      { new: true }
    );
    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ 5. Delete a bill
exports.deleteBill = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Bill deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ 6. PayMongo Webhook (AUTOMATIC UPDATE)
// CRITICAL FIX: Enhanced path checking for Checkout Sessions
exports.paymongoWebhook = async (req, res) => {
  try {
    const event = req.body.data;
    const eventType = event.attributes.type;

    if (eventType === 'checkout_session.payment.paid') {
      // PayMongo nests the payment attributes inside the payload for checkout sessions
      const paymentObj = event.attributes.payload.payment.attributes;
      const description = paymentObj.description || "";
      
      console.log("📥 Webhook Received. Processing description:", description);

      // Extract Bill ID from: "Bill ID: 65f123456789..."
      const billId = description.includes("Bill ID: ") 
        ? description.split("Bill ID: ")[1].trim() 
        : null;

      if (billId) {
        const updated = await Payment.findByIdAndUpdate(
          billId, 
          {
            status: 'PAID',
            transactionNo: paymentObj.external_reference || event.id,
            paidAt: new Date()
          },
          { new: true }
        );

        if (updated) {
          console.log(`✅ DATABASE UPDATED: Bill ${billId} is now PAID`);
        } else {
          console.log(`❌ Bill ID ${billId} not found in database.`);
        }
      }
    }
    // Always return 200 to acknowledge receipt to PayMongo
    res.status(200).send('OK');
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    res.status(500).send('Webhook Error');
  }
};

// ✅ 7. Create PayMongo Link (Resident Checkout)
exports.createPayMongoLink = async (req, res) => {
  try {
    const { billId, amount, type } = req.body;

    const options = {
      method: 'POST',
      url: 'https://api.paymongo.com/v1/checkout_sessions',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
      },
      data: {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description: `Bill ID: ${billId}`, // This is what the webhook parses!
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(amount * 100),
                name: type,
                quantity: 1
              }
            ],
            payment_method_types: ['gcash', 'paymaya', 'card'],
            reference_number: billId,
            success_url: 'https://fcapp-backend.onrender.com/api/payments/success', 
          }
        }
      }
    };

    const response = await axios.request(options);
    res.status(200).json({ checkoutUrl: response.data.data.attributes.checkout_url });
  } catch (err) {
    console.error("❌ PayMongo Link Error:", err.response?.data || err.message);
    res.status(500).json({ message: "Could not create payment link" });
  }
};

// ✅ 8. Payment Success Page
exports.paymentSuccess = (req, res) => {
    res.send(`
        <div style="text-align:center; padding:50px; font-family:sans-serif; background-color:#F8FAFB; min-height:100vh;">
            <div style="background:white; display:inline-block; padding:40px; border-radius:20px; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">
                <h1 style="color:#176F63; font-size: 40px; margin-bottom: 10px;">✔</h1>
                <h2 style="color:#176F63; margin-top:0;">Payment Successful!</h2>
                <p style="color:#666;">Your transaction has been processed. <br> You can now safely close this tab.</p>
                <p style="font-weight:bold; color:#176F63;">Return to the App to see your updated status.</p>
            </div>
        </div>
    `);
};