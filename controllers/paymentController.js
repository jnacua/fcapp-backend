const Payment = require('../models/paymentModel');
const User = require('../models/userModel'); 
const axios = require('axios');
const nodemailer = require('nodemailer');

// ================= EMAIL CONFIGURATION (GMAIL) =================

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nacuapaolo@gmail.com',
    pass: process.env.EMAIL_PASS 
  }
});

// ✅ Reusable Receipt Email Function
const sendReceiptEmail = async (userEmail, billData) => {
  const mailOptions = {
    from: `"FCAPP Utilities" <nacuapaolo@gmail.com>`,
    to: userEmail,
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
    from: `"FCAPP Utilities" <nacuapaolo@gmail.com>`,
    to: userEmail,
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
    const { userId, userName, amount, type, month, prevReading, currReading, ratePerCubic, dueDate } = req.body;
    if (!userId || userId === "null") return res.status(400).json({ message: "User ID is required" });

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
    const payment = await Payment.findByIdAndUpdate(id, { status: status?.toUpperCase() || 'UNPAID', transactionNo }, { new: true }).populate('userId');
    if (!payment) return res.status(404).json({ message: "Record not found" });
    if (payment.status === 'PAID' && payment.userId?.email) await sendReceiptEmail(payment.userId.email, payment);
    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ UPDATED: SOFT DELETE (ARCHIVE)
exports.deleteBill = async (req, res) => {
  try {
    // Instead of deleting, we flag it. 
    // Make sure your Mongoose Schema has isArchived: { type: Boolean, default: false }
    await Payment.findByIdAndUpdate(req.params.id, { isArchived: true });
    res.status(200).json({ message: "Bill moved to archive" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Logic for restoring archived bills
exports.restoreBill = async (req, res) => {
  try {
    await Payment.findByIdAndUpdate(req.params.id, { isArchived: false });
    res.status(200).json({ message: "Bill restored from archive" });
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
      const response = await axios.get(`https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`, {
          headers: { accept: 'application/json', authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}` }
      });
      const sessionData = response.data.data.attributes;
      const billId = sessionData.reference_number || sessionData.metadata?.billId;
      if (billId) {
        const updated = await Payment.findByIdAndUpdate(billId, { status: 'PAID', transactionNo: checkoutSessionId, paidAt: new Date() }, { new: true }).populate('userId'); 
        if (updated && updated.userId?.email) await sendReceiptEmail(updated.userId.email, updated);
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send('Error');
  }
};

exports.sendManualReminder = async (req, res) => {
  try {
    const { billId } = req.body;
    const bill = await Payment.findById(billId);
    if (!bill) return res.status(404).json({ message: "Payment record not found." });
    let residentEmail = null;
    try {
      const nameUser = await User.findOne({ name: new RegExp('^' + bill.userName + '$', 'i') });
      if (nameUser && nameUser.email) residentEmail = nameUser.email;
    } catch (e) {}
    if (!residentEmail && bill.userId) {
      try {
        const directUser = await User.findById(bill.userId);
        if (directUser && directUser.email) residentEmail = directUser.email;
      } catch (error) {}
    }
    if (!residentEmail) return res.status(404).json({ message: "Resident email is required or invalid" });
    const success = await sendReminderEmail(residentEmail, bill);
    res.status(success ? 200 : 500).json({ message: success ? "Sent" : "Failed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPayMongoLink = async (req, res) => {
  try {
    const { billId, amount, type } = req.body;
    const response = await axios.post('https://api.paymongo.com/v1/checkout_sessions', {
        data: { attributes: { send_email_receipt: true, show_description: true, reference_number: billId.toString(), metadata: { billId: billId.toString() },
            line_items: [{ currency: 'PHP', amount: Math.round(Number(amount) * 100), name: type, quantity: 1 }],
            payment_method_types: ['gcash', 'paymaya', 'card'],
            success_url: 'https://fcapp-backend.onrender.com/api/payments/success', 
          } }
      }, { headers: { accept: 'application/json', 'Content-Type': 'application/json', authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}` }
    });
    res.status(200).json({ checkoutUrl: response.data.data.attributes.checkout_url });
  } catch (err) {
    res.status(500).json({ message: "Error creating link" });
  }
};

exports.paymentSuccess = (req, res) => {
    res.send(`<div style="text-align:center; padding:50px; font-family:sans-serif;"><h2 style="color:#176F63;">Payment Successful!</h2><p>Check your email for the official receipt.</p></div>`);
};