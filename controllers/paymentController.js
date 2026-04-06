const Payment = require('../models/paymentModel');
const axios = require('axios');

// ✅ 1. Get ALL payments (Admin view for the tables)
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
    // Auto-calculate if it's a water bill
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

// ✅ 4. Update payment status (Manual Admin Update for Cash Payments)
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

// ✅ 5. Delete a bill (Trash icon)
exports.deleteBill = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Bill deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ 6. PayMongo Webhook (AUTOMATIC UPDATE)
// 🚨 CRITICAL: Specifically handles the "checkout_session.payment.paid" event
exports.paymongoWebhook = async (req, res) => {
  try {
    const event = req.body.data;
    const eventType = event.attributes.type;

    console.log(`📥 WEBHOOK RECEIVED: ${eventType}`);

    if (eventType === 'checkout_session.payment.paid') {
      // For Checkout Sessions, attributes are nested in attributes.payload.payment.attributes
      const paymentData = event.attributes.payload.payment.attributes;
      const description = paymentData.description || "";
      
      console.log("📝 PROCESSING DESCRIPTION:", description);

      // Extract Bill ID from the string: "Bill ID: 65f123456789..."
      const billId = description.includes("Bill ID: ") 
        ? description.split("Bill ID: ")[1].trim() 
        : null;

      if (billId) {
        const updated = await Payment.findByIdAndUpdate(
          billId, 
          {
            status: 'PAID',
            transactionNo: paymentData.external_reference || event.id,
            paidAt: new Date()
          },
          { new: true }
        );

        if (updated) {
          console.log(`✅ DATABASE UPDATED: Bill ${billId} is now PAID`);
        } else {
          console.log(`❌ DATABASE ERROR: Bill ID ${billId} not found in collection.`);
        }
      } else {
        console.log("⚠️ WEBHOOK WARNING: No Bill ID found in the payment description.");
      }
    }
    // PayMongo requires a 200 response to acknowledge receipt
    res.status(200).send('OK');
  } catch (err) {
    console.error("❌ WEBHOOK CRITICAL ERROR:", err.message);
    res.status(500).send('Webhook Processing Failed');
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
            // 🚨 THIS STRING MUST BE EXACTLY PARSED BY THE WEBHOOK (SECTION 6)
            description: `Bill ID: ${billId}`, 
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(amount * 100), // convert to centavos
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
    console.error("❌ PAYMONGO API ERROR:", err.response?.data || err.message);
    res.status(500).json({ message: "Could not create payment link" });
  }
};

// ✅ 8. Payment Success Page (Visual feedback for the resident's browser)
exports.paymentSuccess = (req, res) => {
    res.send(`
        <div style="text-align:center; padding:50px; font-family:sans-serif; background-color:#F8FAFB; min-height:100vh;">
            <div style="background:white; display:inline-block; padding:40px; border-radius:20px; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">
                <div style="color:#176F63; font-size: 60px; margin-bottom: 10px;">✔</div>
                <h2 style="color:#176F63; margin-top:0; font-weight:900;">Payment Successful!</h2>
                <p style="color:#666; line-height:1.6;">Your transaction has been processed. <br> You can now safely close this tab.</p>
                <div style="margin-top:25px; padding:15px; background-color:#e8f5f3; border-radius:10px;">
                  <p style="font-weight:bold; color:#176F63; margin:0;">Return to the App and refresh to see your updated status.</p>
                </div>
            </div>
        </div>
    `);
};