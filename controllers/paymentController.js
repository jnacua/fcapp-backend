const Payment = require('../models/paymentModel');

// ✅ 1. Get ALL payments (Admin view for the tables)
exports.getAll = async (req, res) => {
  try {
    // Sort by newest first so the latest bills appear at the top of the Flutter table
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ 2. Create a Bill (Used by your 'Generate' Dialogs)
exports.create = async (req, res) => {
  try {
    const { 
      userId, 
      userName, 
      amount, 
      type, 
      month, 
      prevReading, 
      currReading, 
      ratePerCubic 
    } = req.body;

    // Logic for Water Bill Auto-Computation
    let finalAmount = amount;
    if (type === 'Water Bill' && currReading !== undefined && prevReading !== undefined) {
       const consumption = currReading - prevReading;
       const rate = ratePerCubic || 25;
       finalAmount = consumption * rate;
    }

    const newPayment = new Payment({
      userId,
      userName, // Important: Matches your Flutter bill['userName']
      type,     // 'Water Bill' or 'Monthly Dues'
      amount: finalAmount,
      month,
      prevReading: prevReading || 0,
      currReading: currReading || 0,
      ratePerCubic: ratePerCubic || 25,
      status: 'UNPAID', // Default to UNPAID so it shows red in Flutter
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // Default 15 days due
    });

    await newPayment.save();
    res.status(201).json(newPayment);
  } catch (err) {
    console.error("Error creating bill:", err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ 3. Get payments for a specific Resident (Resident View)
exports.getMyBills = async (req, res) => {
  try {
    // req.user.id comes from your protect middleware
    const bills = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your bills' });
  }
};

// ✅ 4. Update payment status (Approved/Rejected/Paid)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionNo } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      id,
      { 
        status: status.toUpperCase(), // Standardize to PAID/UNPAID
        transactionNo: transactionNo 
      },
      { new: true }
    );

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ 5. Delete a bill (For the Trash icon in your Flutter table)
exports.deleteBill = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: "Bill deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting bill" });
  }
};