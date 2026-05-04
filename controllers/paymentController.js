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
            ${billData.consumption ? `<tr style="background-color: #f9f9f9;"><td style="padding: 8px;"><b>Water Consumption:</b></td><td>${billData.consumption} m³</td></tr>` : ''}
            ${billData.waterCharge ? `<tr><td style="padding: 8px;"><b>Water Charge:</b></td><td>₱ ${billData.waterCharge.toFixed(2)}</td></tr>` : ''}
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

// ================= HELPER FUNCTIONS =================

/**
 * Get previous reading for a user to calculate consumption
 */
async function getPreviousReading(userId, currentMonth, currentYear) {
  try {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    let prevMonthNum = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonthNum < 1) {
      prevMonthNum = 12;
      prevYear = currentYear - 1;
    }
    
    const previousBill = await Payment.findOne({
      userId: userId,
      type: 'Water Bill',
      month: monthNames[prevMonthNum - 1],
      year: prevYear
    }).sort({ createdAt: -1 });
    
    if (previousBill && previousBill.currReading) {
      console.log(`✅ Previous reading found for ${userId}: ${previousBill.currReading} m³`);
      return previousBill.currReading;
    }
    console.log(`⚠️ No previous reading found for ${userId}, starting from 0`);
    return 0;
  } catch (error) {
    console.error("Error fetching previous reading:", error);
    return 0;
  }
}

/**
 * Calculate Manila Water Bill based on consumption
 */
function calculateManilaWaterBill(consumption) {
  if (consumption <= 0) {
    return {
      waterCharge: 0,
      basicServiceCharge: 50.00,
      environmentalFee: 0,
      sewerFee: 0,
      vat: 0,
      totalAmount: 50.00
    };
  }
  
  let waterCharge = 0;
  let remaining = consumption;
  
  // Tier 1: 0-10 m³ @ ₱52.00
  const tier1 = Math.min(remaining, 10);
  waterCharge += tier1 * 52.00;
  remaining -= tier1;
  
  // Tier 2: 11-20 m³ @ ₱70.50
  if (remaining > 0) {
    const tier2 = Math.min(remaining, 10);
    waterCharge += tier2 * 70.50;
    remaining -= tier2;
  }
  
  // Tier 3: 21-30 m³ @ ₱85.00
  if (remaining > 0) {
    const tier3 = Math.min(remaining, 10);
    waterCharge += tier3 * 85.00;
    remaining -= tier3;
  }
  
  // Tier 4: 31-40 m³ @ ₱102.00
  if (remaining > 0) {
    const tier4 = Math.min(remaining, 10);
    waterCharge += tier4 * 102.00;
    remaining -= tier4;
  }
  
  // Tier 5: 41+ m³ @ ₱120.00
  if (remaining > 0) {
    waterCharge += remaining * 120.00;
  }
  
  const basicServiceCharge = 50.00;
  const environmentalFee = waterCharge * 0.20;
  const sewerFee = waterCharge * 0.30;
  const subtotal = waterCharge + basicServiceCharge + environmentalFee + sewerFee;
  const vat = subtotal * 0.12;
  const totalAmount = subtotal + vat;
  
  console.log("=== WATER BILL CALCULATION ===");
  console.log(`Consumption: ${consumption} m³`);
  console.log(`Water Charge: ₱${waterCharge.toFixed(2)}`);
  console.log(`Basic Service Charge: ₱${basicServiceCharge.toFixed(2)}`);
  console.log(`Environmental Fee (20%): ₱${environmentalFee.toFixed(2)}`);
  console.log(`Sewer Fee (30%): ₱${sewerFee.toFixed(2)}`);
  console.log(`Subtotal: ₱${subtotal.toFixed(2)}`);
  console.log(`VAT (12%): ₱${vat.toFixed(2)}`);
  console.log(`TOTAL: ₱${totalAmount.toFixed(2)}`);
  
  return {
    waterCharge: parseFloat(waterCharge.toFixed(2)),
    basicServiceCharge: 50.00,
    environmentalFee: parseFloat(environmentalFee.toFixed(2)),
    sewerFee: parseFloat(sewerFee.toFixed(2)),
    vat: parseFloat(vat.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2))
  };
}

// ================= CONTROLLERS =================

exports.getAll = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.status(200).json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ FIXED: Create bill with proper values from frontend
exports.create = async (req, res) => {
  try {
    const { 
      userId, 
      userName, 
      amount, 
      type, 
      month, 
      year, 
      prevReading,
      currReading,
      consumption,
      ratePerCubic,
      waterCharge,
      basicServiceCharge,
      environmentalFee,
      sewerFee,
      vat,
      dueDate,
      meterNumber 
    } = req.body;
    
    console.log("📝 Creating bill with data:", {
      userId,
      userName,
      type,
      month,
      year,
      prevReading,
      currReading,
      consumption,
      amount
    });
    
    if (!userId || userId === "null") {
      return res.status(400).json({ message: "User ID is required" });
    }
    
    const billType = type || "Water Bill";
    const billMonth = month || new Date().toLocaleString('default', { month: 'long' });
    const billYear = year || new Date().getFullYear();
    
    // ✅ Check for duplicate bill
    const existingBill = await Payment.findOne({
      userId,
      type: billType,
      month: billMonth,
      year: billYear
    });
    
    if (existingBill) {
      return res.status(400).json({ 
        message: `A ${billType} for ${billMonth} ${billYear} already exists for this resident` 
      });
    }
    
    let finalAmount = amount || 0;
    let finalPrevReading = prevReading || 0;
    let finalCurrReading = currReading || 0;
    let finalConsumption = consumption || 0;
    let waterBillDetails = null;
    
    // If it's a water bill but no consumption provided, calculate it
    if (billType.toLowerCase().includes('water') && finalConsumption === 0 && finalCurrReading > 0) {
      finalConsumption = finalCurrReading - finalPrevReading;
      if (finalConsumption < 0) finalConsumption = 0;
      
      // Calculate bill amount
      waterBillDetails = calculateManilaWaterBill(finalConsumption);
      finalAmount = waterBillDetails.totalAmount;
    }
    
    const newPayment = new Payment({
      userId,
      userName: userName || "Resident",
      type: billType,
      amount: finalAmount,
      month: billMonth,
      year: billYear,
      prevReading: finalPrevReading,
      currReading: finalCurrReading,
      consumption: finalConsumption,
      ratePerCubic: ratePerCubic || (finalConsumption > 0 ? finalAmount / finalConsumption : 0),
      status: 'UNPAID',
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      meterNumber: meterNumber || '',
      waterCharge: waterBillDetails ? waterBillDetails.waterCharge : (waterCharge || 0),
      basicServiceCharge: waterBillDetails ? waterBillDetails.basicServiceCharge : (basicServiceCharge || 50),
      environmentalFee: waterBillDetails ? waterBillDetails.environmentalFee : (environmentalFee || 0),
      sewerFee: waterBillDetails ? waterBillDetails.sewerFee : (sewerFee || 0),
      vat: waterBillDetails ? waterBillDetails.vat : (vat || 0),
      isFinalized: true
    });

    await newPayment.save();
    
    console.log(`✅ Bill created: ${billType} for ${userName}`);
    console.log(`   Amount: ₱${finalAmount}`);
    console.log(`   Consumption: ${finalConsumption} m³`);
    console.log(`   Prev Reading: ${finalPrevReading} → Curr Reading: ${finalCurrReading}`);
    
    res.status(201).json(newPayment);
    
  } catch (err) {
    console.error("Create bill error:", err);
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
    const { status, transactionNo, paymentMethod } = req.body;
    
    const payment = await Payment.findByIdAndUpdate(
      id, 
      { 
        status: status?.toUpperCase() || 'UNPAID', 
        transactionNo,
        paymentMethod,
        paidAt: status?.toUpperCase() === 'PAID' ? new Date() : null
      }, 
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

// ✅ SOFT DELETE (ARCHIVE)
exports.deleteBill = async (req, res) => {
  try {
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
        headers: { 
          accept: 'application/json', 
          authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}` 
        }
      });
      
      const sessionData = response.data.data.attributes;
      const metadata = sessionData.metadata || {};
      
      // ✅ NEW: Handle bulk payment (multiple bills)
      if (metadata.type === 'bulk_monthly_dues' && metadata.billIds) {
        const billIds = JSON.parse(metadata.billIds);
        console.log(`📦 Processing bulk payment for ${billIds.length} bills`);
        
        // Update all bills to PAID status
        const updatedBills = await Payment.updateMany(
          { _id: { $in: billIds } },
          { 
            status: 'PAID', 
            transactionNo: checkoutSessionId, 
            paidAt: new Date(),
            paymentMethod: 'PAYMONGO'
          }
        );
        
        console.log(`✅ Bulk payment processed: ${updatedBills.modifiedCount} bills updated`);
        
        // Send individual receipts for each bill
        const bills = await Payment.find({ _id: { $in: billIds } }).populate('userId');
        for (const bill of bills) {
          if (bill.userId?.email) {
            await sendReceiptEmail(bill.userId.email, bill);
          }
        }
      }
      // ✅ Handle single bill payment
      else {
        const billId = sessionData.reference_number || metadata.billId;
        
        if (billId) {
          const updated = await Payment.findByIdAndUpdate(
            billId, 
            { 
              status: 'PAID', 
              transactionNo: checkoutSessionId, 
              paidAt: new Date(),
              paymentMethod: 'PAYMONGO'
            }, 
            { new: true }
          ).populate('userId'); 
          
          if (updated && updated.userId?.email) {
            await sendReceiptEmail(updated.userId.email, updated);
          }
        }
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error("Webhook error:", err);
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
    
    if (!residentEmail) {
      return res.status(404).json({ message: "Resident email is required or invalid" });
    }
    
    const success = await sendReminderEmail(residentEmail, bill);
    res.status(success ? 200 : 500).json({ message: success ? "Reminder sent" : "Failed to send" });
  } catch (err) {
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
              quantity: 1,
              description: `${type} for ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`
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
    console.error("PayMongo error:", err);
    res.status(500).json({ message: "Error creating payment link" });
  }
};

exports.paymentSuccess = (req, res) => {
  res.send(`
    <div style="text-align:center; padding:50px; font-family:sans-serif;">
      <h2 style="color:#176F63;">✅ Payment Successful!</h2>
      <p>Thank you for your payment. Check your email for the official receipt.</p>
      <p>You may now close this window.</p>
    </div>
  `);
};