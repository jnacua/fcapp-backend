const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // ✅ ADD THIS: Storing the name directly makes your Flutter ListViews much faster
  userName: { type: String, required: true }, 

  // ✅ UPDATE: Match the strings used in your Flutter logic ('Water Bill' vs 'Water')
  type: { type: String, enum: ['Water Bill', 'Monthly Dues'], required: true },
  
  month: { type: String, required: true }, 
  
  // Meter readings for auto-computation
  prevReading: { type: Number, default: 0 },
  currReading: { type: Number, default: 0 },
  ratePerCubic: { type: Number, default: 25 }, 
  
  amount: { type: Number, required: true }, 
  
  // ✅ UPDATE: Standardize status to match your Flutter filtering (ALL, PAID, UNPAID)
  status: { type: String, enum: ['UNPAID', 'PENDING', 'PAID'], default: 'UNPAID' },
  
  transactionNo: { type: String },
  receiptImagePath: { type: String },
  dueDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);