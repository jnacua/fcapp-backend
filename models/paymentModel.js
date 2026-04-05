const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true }, 
  type: { type: String, enum: ['Water Bill', 'Monthly Dues'], required: true },
  month: { type: String, required: true }, // ❌ If Flutter sends null, this crashes
  
  prevReading: { type: Number, default: 0 },
  currReading: { type: Number, default: 0 },
  ratePerCubic: { type: Number, default: 25 }, 
  
  amount: { type: Number, required: true }, 
  status: { type: String, enum: ['UNPAID', 'PENDING', 'PAID'], default: 'UNPAID' },
  
  transactionNo: { type: String },
  receiptImagePath: { type: String },
  // ✅ Change: Provide a default function for dueDate so it never fails
  dueDate: { 
    type: Date, 
    required: true, 
    default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) 
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);