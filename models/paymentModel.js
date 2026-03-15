const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['Water', 'Monthly Dues'], required: true },
  month: { type: String, required: true }, 
  
  // Meter readings for auto-computation
  prevReading: { type: Number, default: 0 },
  currReading: { type: Number, default: 0 },
  ratePerCubic: { type: Number, default: 25 }, // Fixed rate
  
  amount: { type: Number, required: true }, // Result of computation
  status: { type: String, enum: ['Unpaid', 'Pending', 'Paid'], default: 'Unpaid' },
  transactionNo: { type: String },
  receiptImagePath: { type: String },
  dueDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);