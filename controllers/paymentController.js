const Payment = require('../models/paymentModel');
const axios = require('axios');
const nodemailer = require('nodemailer');

// ================= EMAIL CONFIGURATION =================

// ✅ Setup the Gmail Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail
    pass: process.env.EMAIL_PASS  // Your Gmail App Password
  }
});

// ✅ Reusable Receipt Email Function
const sendReceiptEmail = async (userEmail, billData) => {
  const mailOptions = {
    from: `"FCAPP Utilities" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `Payment Receipt - ${billData.month} ${new Date().getFullYear()}`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; border-radius: 10px;">
        <div style="background-color: #176F63; color: white; padding: 10px; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin:0;">PAYMENT SUCCESSFUL</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hi <b>${billData.userName}</b>,</p>
          <p>Thank you for your payment. Here are your transaction details:</p>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f9f9f9;"><td style="padding: 8px;"><b>Bill Type:</b></td><td>${billData.type}</td></tr>
            <tr><td style="padding: 8px;"><b>Month:</b></td><td>${billData.month}</td></tr>
            <tr style="background-color: #f9f9f9;"><td style="padding: 8px;"><b>Amount Paid:</b></td><td>₱ ${billData.amount.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px;"><b>Status:</b></td><td style="color: #176F63;"><b>PAID</b></td></tr>
            <tr style="background-color: #f9f9f9;"><td style="padding: 8px;"><b>Transaction No:</b></td><td>${billData.transactionNo || 'N/A'}</td></tr>
            <tr><td style="padding: 8px;"><b>Date Paid:</b></td><td>${new Date().toLocaleDateString()}</td></tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666; text-align: center;">
            Fiesta Casitas Subdivision Office<br>
            Binangonan, Rizal, 1940
          </p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Receipt successfully sent to: ${userEmail}`);
  } catch (error) {
    console.error("📧 Email sending failed:", error);
  }
};

// ================= CONTROLLERS =================

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

// ✅ 4. Update payment status (Manual Admin Update + Email Trigger)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionNo } = req.body;

    // Use .populate('userId') so we have the email address for the receipt
    const payment = await Payment.findByIdAndUpdate(
      id,
      { 
        status: status ? status.toUpperCase() : 'UNPAID', 
        transactionNo: transactionNo 
      },
      { new: true }
    ).populate('userId');

    if (!payment) return res.status(404).json({ message: "Payment record not found" });

    // ✅ TRIGGER EMAIL: If marked as PAID manually by Admin
    if (payment.status === 'PAID' && payment.userId && payment.userId.email) {
      await sendReceiptEmail(payment.userId.email, payment);
    }

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

// ✅ 6. PayMongo Webhook (Automatic Payment Verification + Email Trigger)
exports.paymongoWebhook = async (req, res) => {
  try {
    const data = req.body.data;
    const eventType = data?.attributes?.type;

    console.log(`📥 WEBHOOK RECEIVED: ${eventType}`);

    if (eventType === 'checkout_session.payment.paid') {
      const bodyString = JSON.stringify(req.body);
      const csMatch = bodyString.match(/cs_[a-zA-Z0-9]+/);
      const checkoutSessionId = csMatch ? csMatch[0] : null;
      
      console.log(`🔍 CS_ID FOUND: ${checkoutSessionId}`);

      if (!checkoutSessionId) return res.status(200).send('OK');

      const response = await axios.get(
        `https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`,
        {
          headers: {
            accept: 'application/json',
            authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
          }
        }
      );

      const sessionData = response.data.data.attributes;
      const billId = sessionData.reference_number || sessionData.metadata?.billId;

      if (billId && billId !== "null" && billId !== "undefined") {
        // ✅ TRIGGER LOGIC START: Update and Populate User Email
        const updated = await Payment.findByIdAndUpdate(
          billId,
          {
            status: 'PAID',
            transactionNo: checkoutSessionId, 
            paidAt: new Date()
          },
          { new: true }
        ).populate('userId'); 

        if (updated && updated.userId && updated.userId.email) {
          console.log(`✅ SUCCESS: Sending Receipt to ${updated.userId.email}`);
          // ✅ EXECUTE AUTOMATIC EMAIL TRIGGER
          await sendReceiptEmail(updated.userId.email, updated);
        } else {
          console.log(`❌ FAIL: User email not found for Bill ${billId}`);
        }
      }
    }
    
    res.status(200).send('OK');
  } catch (err) {
    console.error("🔥 WEBHOOK ERROR:", err.response?.data || err.message);
    res.status(500).send('Internal Server Error');
  }
};

// ✅ 7. Create PayMongo Link (Resident Checkout)
exports.createPayMongoLink = async (req, res) => {
  try {
    const { billId, amount, type } = req.body;

    console.log(`🚀 CREATING LINK: Bill ${billId} for ${amount} PHP`);

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
            description: `BILL_ID_${billId}`, 
            reference_number: billId.toString(), 
            metadata: { billId: billId.toString() },
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(Number(amount) * 100),
                name: type,
                quantity: 1
              }
            ],
            payment_method_types: ['gcash', 'paymaya', 'card'],
            success_url: 'https://fcapp-backend.onrender.com/api/payments/success', 
          }
        }
      }
    };

    const response = await axios.request(options);
    res.status(200).json({ checkoutUrl: response.data.data.attributes.checkout_url });
  } catch (err) {
    console.error("❌ API ERROR:", err.response?.data || err.message);
    res.status(500).json({ message: "Error" });
  }
};

// ✅ 8. Payment Success Page
exports.paymentSuccess = (req, res) => {
    res.send(`
        <div style="text-align:center; padding:50px; font-family:sans-serif; background-color:#F8FAFB; min-height:100vh;">
            <div style="background:white; display:inline-block; padding:40px; border-radius:20px; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">
                <div style="color:#176F63; font-size: 60px; margin-bottom: 10px;">✔</div>
                <h2 style="color:#176F63; margin-top:0; font-weight:900;">Payment Successful!</h2>
                <p style="color:#666; line-height:1.6;">Your transaction has been processed. <br> You will receive an official receipt in your Gmail shortly.</p>
            </div>
        </div>
    `);
};