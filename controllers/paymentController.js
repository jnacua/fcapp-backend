const Payment = require('../models/paymentModel');

// ✅ 1. Get ALL payments (Admin view for the tables)
exports.getAll = async (req, res) => {
  try {
    // Sort by newest first so the latest bills appear at the top of the Flutter table
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.status(200).json(payments);
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
      ratePerCubic,
      dueDate 
    } = req.body;

    // --- Safety Check: Prevent 500 crashes if required fields are missing ---
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // --- Logic for Water Bill Auto-Computation ---
    let finalAmount = amount || 0;
    if (type === 'Water Bill') {
       const consumption = (Number(currReading) || 0) - (Number(prevReading) || 0);
       const rate = Number(ratePerCubic) || 25;
       finalAmount = consumption * rate;
    }

    // --- Create Document with Fallbacks to satisfy Mongoose 'required' tags ---
    const newPayment = new Payment({
      userId,
      userName: userName || "Resident", // Fallback to prevent crash
      type: type || "Monthly Dues",      // Fallback to prevent crash
      amount: finalAmount,
      month: month || new Date().toLocaleString('default', { month: 'long' }), // Default to current month
      prevReading: prevReading || 0,
      currReading: currReading || 0,
      ratePerCubic: ratePerCubic || 25,
      status: 'UNPAID',
      // If dueDate is passed from Flutter, use it; otherwise, default to 15 days from now
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    });

    await newPayment.save();
    res.status(201).json(newPayment);
  } catch (err) {
    // This will print the EXACT field that caused the crash in your Render Logs
    console.error("❌ DATABASE SAVE ERROR:", err.message); 
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ 3. Get payments for a specific Resident (Resident View)
exports.getMyBills = async (req, res) => {
  try {
    // req.user.id comes from your protect middleware
    const bills = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your bills', error: err.message });
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
        status: status ? status.toUpperCase() : 'UNPAID', // Standardize to PAID/UNPAID
        transactionNo: transactionNo 
      },
      { new: true }
    );

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ 5. Delete a bill (For the Trash icon in your Flutter table)
exports.deleteBill = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: "Bill not found" });
    
    res.status(200).json({ message: "Bill deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting bill", error: err.message });
  }
};