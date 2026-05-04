const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true }, 
  type: { type: String, enum: ['Water Bill', 'Monthly Dues'], required: true },
  month: { type: String, required: true }, // Format: "January 2026"
  year: { type: Number, required: true }, // ✅ Added for easier querying (e.g., 2026)
  
  // Water meter tracking
  meterNumber: { type: String, default: '' }, // ✅ Unique meter number per household
  prevReading: { type: Number, default: 0 },
  currReading: { type: Number, default: 0 },
  consumption: { type: Number, default: 0 }, // ✅ Calculated: currReading - prevReading
  
  // Manila Water Rate Breakdown
  waterCharge: { type: Number, default: 0 }, // ✅ Base water charge based on consumption
  basicServiceCharge: { type: Number, default: 50 }, // ✅ Fixed charge
  environmentalFee: { type: Number, default: 0 }, // ✅ 20% of water charge
  sewerFee: { type: Number, default: 0 }, // ✅ 30% of water charge
  vat: { type: Number, default: 0 }, // ✅ 12% of subtotal
  
  ratePerCubic: { type: Number, default: 0 }, // ✅ Will be calculated based on consumption
  amount: { type: Number, required: true }, // Total amount (final bill)
  
  status: { type: String, enum: ['UNPAID', 'PENDING', 'PAID'], default: 'UNPAID' },
  
  transactionNo: { type: String },
  receiptImagePath: { type: String },
  
  // Payment tracking
  paidAt: { type: Date },
  paymentMethod: { type: String, enum: ['CASH', 'BANK_TRANSFER', 'GCASH', 'PAYMONGO'], default: null },
  
  // Bill finalization (prevent edits after creation)
  isFinalized: { type: Boolean, default: false },
  
  dueDate: { 
    type: Date, 
    required: true, 
    default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) 
  }
}, { timestamps: true });

// ✅ Compound index to prevent duplicate bills per user per month
PaymentSchema.index({ userId: 1, month: 1, year: 1, type: 1 }, { unique: true });

// ✅ Index for faster queries
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ meterNumber: 1 });
PaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);