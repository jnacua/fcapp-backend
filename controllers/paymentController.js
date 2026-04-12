const Payment = require('../models/paymentModel');
const User = require('../models/userModel'); // 🛡️ Directly imported for the fallback search
const axios = require('axios');
const nodemailer = require('nodemailer');

// ================= EMAIL CONFIGURATION (BREVO) =================

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587, // ✅ Port 587 is more secure and stable for Render-to-Gmail traffic
  secure: false,
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  },
  tls: { rejectUnauthorized: false }
});

// ✅ Reusable Receipt Email Function
const sendReceiptEmail = async (userEmail, billData) => {
  const mailOptions = {
    // 🛡️ AUTHENTICATED MASK: Bypasses Gmail's security filters that block personal gmail addresses sent via SMTP
    from: `"FCAPP Utilities" <mail-sender@brevo.com>`, 
    to: userEmail,
    replyTo: 'jeianpaolonacua07@gmail.com', // Residents see this when they click reply
    subject: `Official Receipt - ${billData.month} ${new Date().getFullYear()}`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; border-radius: 10px;">
        <div style="background-color: #176F63; color: white; padding: 10px; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin:0;">OFFICIAL RECEIPT</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hi <b>${billData.userName}</b>,</p>
          <p>Your payment was successful. Below are your transaction details:</p>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f9f9f9;"><td style="padding: 8px;"><b>Bill Type:</b></td><td>${billData.type}</td></tr>
            <tr><td style="padding: 8px;"><b>Month:</b></td><td>${billData.month}</td></tr>
            <tr style="background-color: #f9f9f9;"><td style="padding: 8px;"><b>Amount Paid:</b></td><td>₱ ${Number(billData.amount).toFixed(2)}</td></tr>
            <tr><td style="padding: 8px;"><b>Status:</b></td><td style="color: #176F63;"><b>PAID</b></td></tr>
            <tr style="background-color: #f9f9f9;"><td style="padding: 8px;"><b>Transaction ID:</b></td><td style="font-size:11px;">${billData.transactionNo || 'N/A'}</td></tr>
            <tr><td style="padding: 8px;"><b>Date Paid:</b></td><td>${new Date().toLocaleDateString()}</td></tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #eee;">
          <p style="font-size: 11px; color: #666; text-align: center;">Fiesta Casitas Subdivision Office</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Official Receipt sent to: ${userEmail}`);
  } catch (error) {
    console.error("📧 Email sending failed:", error.message);
  }
};

// ✅ Reusable Reminder Email Function
const sendReminderEmail = async (userEmail, billData) => {
  const mailOptions = {
    // 🛡️ AUTHENTICATED MASK: This tells Gmail that Brevo is the authorized sender
    from: `"FCAPP Utilities" <mail-sender@brevo.com>`, 
    to: userEmail,
    replyTo: 'jeianpaolonacua07@gmail.com',
    subject: `Urgent: Unpaid ${billData.type} - ${billData.month}`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #f5c6cb; padding: 20px; max-width: 600px; border-radius: 10px; background-color: #fff3f3;">
        <div style="background-color: #721c24; color: white; padding: 10px; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin:0;">PAYMENT REMINDER</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hi <b>${billData.userName}</b>,</p>
          <p>You have an outstanding balance for <b>${billData.type}</b> for the month of <b>${billData.month}</b>.</p>
          <hr style="border: 0; border-top: 1px solid #f5c6cb;">
          <p><b>Amount Due: ₱ ${Number(billData.amount).toFixed(2)}</b></p>
          <p>Please settle this using the FCAPP Mobile App.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Reminder sent to: ${userEmail}`);
    return true;
  } catch (error) {
    console.error("📧 Reminder failed:", error.message);
    return false;
  }
};

// ================= CONTROLLERS =================

exports.getAll = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.status(200).json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    console.log("📥 [DEBUG] Incoming Bill Data:", JSON.stringify(req.body, null, 2));
    const { userId, userName, amount, type, month, prevReading, currReading, ratePerCubic, dueDate } = req.body;
    
    if (!userId || userId === "null") {
      return res.status(400).json({ message: "User ID is required" });
    }

    let finalAmount = amount || 0;
    if (type.toLowerCase().includes('water')) {
       const consumption = (Number(currReading) || 0) - (Number(prevReading) || 0);
       finalAmount = consumption * (Number(ratePerCubic) || 25);
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
    console.log(`✅ [DEBUG] Bill saved for ${userName}`);
    res.status(201).json(newPayment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMyBills = async (req, res) => {
  try {
    const bills = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionNo } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      id,
      { status: status?.toUpperCase() || 'UNPAID', transactionNo },
      { new: true }
    ).populate('userId');

    if (!payment) return res.status(404).json({ message: "Record not found" });

    if (payment.status === 'PAID' && payment.userId?.email) {
      await sendReceiptEmail(payment.userId.email, payment);
    }

    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Bill deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.paymongoWebhook = async (req, res) => {
  try {
    const data = req.body.data;
    const eventType = data?.attributes?.type;

    if (eventType === 'checkout_session.payment.paid') {
      const checkoutSessionId = req.body.data.attributes.data.id;
      
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

      if (billId) {
        const updated = await Payment.findByIdAndUpdate(
          billId,
          { status: 'PAID', transactionNo: checkoutSessionId, paidAt: new Date() },
          { new: true }
        ).populate('userId'); 

        if (updated && updated.userId?.email) {
          await sendReceiptEmail(updated.userId.email, updated);
        }
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error("🔥 WEBHOOK ERROR:", err.message);
    res.status(500).send('Error');
  }
};

// ✅ UPDATED: Manual Reminder with Triple-Layer Fallback (String ID fix)
exports.sendManualReminder = async (req, res) => {
  try {
    const { billId } = req.body;
    
    // 1. Find bill and attempt to populate user
    const bill = await Payment.findById(billId).populate('userId');
    if (!bill) return res.status(404).json({ message: "Payment record not found." });

    // 📄 Print full bill state to Render logs for debugging
    console.log("📄 [DEBUG] FULL BILL DATA:", JSON.stringify(bill, null, 2));

    let residentEmail = bill.userId?.email;

    // 🛡️ FALLBACK 1: Search User manually by ID (Fixes String vs ObjectId mismatch)
    if (!residentEmail && bill.userId) {
      console.log("⚠️ Population failed. Searching User by ID manually...");
      const directUser = await User.findById(bill.userId);
      residentEmail = directUser?.email;
    }

    // 🛡️ FALLBACK 2: Search User by NAME (Last resort brute force)
    if (!residentEmail) {
      console.log(`⚠️ ID search failed. Searching User by Name: ${bill.userName}`);
      const nameUser = await User.findOne({ name: bill.userName });
      residentEmail = nameUser?.email;
    }

    if (!residentEmail) {
      console.error(`❌ Still undefined for resident: ${bill.userName}`);
      return res.status(404).json({ message: "Resident email is required or invalid" });
    }

    console.log(`📩 FOUND EMAIL: ${residentEmail}. Sending via Brevo mask...`);

    const success = await sendReminderEmail(residentEmail, bill);
    res.status(success ? 200 : 500).json({ message: success ? "Sent" : "Failed" });
  } catch (err) {
    console.error("❌ sendManualReminder Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.createPayMongoLink = async (req, res) => {
  try {
    const { billId, amount, type } = req.body;
    const response = await axios.post(
      'https://api.paymongo.com/v1/checkout_sessions',
      {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            reference_number: billId.toString(),
            metadata: { billId: billId.toString() },
            line_items: [{
              currency: 'PHP',
              amount: Math.round(Number(amount) * 100),
              name: type,
              quantity: 1
            }],
            payment_method_types: ['gcash', 'paymaya', 'card'],
            success_url: 'https://fcapp-backend.onrender.com/api/payments/success', 
          }
        }
      },
      {
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
        }
      }
    );
    res.status(200).json({ checkoutUrl: response.data.data.attributes.checkout_url });
  } catch (err) {
    res.status(500).json({ message: "Error creating link" });
  }
};

exports.paymentSuccess = (req, res) => {
    res.send(`<div style="text-align:center; padding:50px; font-family:sans-serif;">
        <h2 style="color:#176F63;">Payment Successful!</h2>
        <p>Check your email for the official receipt.</p>
    </div>`);
};