const Payment = require('../models/paymentModel');

// Get all payments (admin or president)
exports.getAll = async (req, res) => {
  try {
    const payments = await Payment.find();
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Create a new payment (user)
exports.create = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    const newPayment = new Payment({
      userId,
      amount,
      status: 'pending', // default status
      date: new Date()
    });

    await newPayment.save();
    res.status(201).json(newPayment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Update payment status (admin or president)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // approved, rejected, etc.

    const payment = await Payment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
