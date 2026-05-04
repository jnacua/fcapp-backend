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
  },
  
  // ✅ PENALTY FIELDS (Fixed penalty for late payments)
  penaltyAmount: { type: Number, default: 0 }, // Fixed penalty amount (e.g., 50)
  isPenaltyApplied: { type: Boolean, default: false }, // Whether penalty has been applied
  penaltyAppliedDate: { type: Date }, // When penalty was applied
  daysOverdue: { type: Number, default: 0 }, // Number of days overdue
  lateFee: { type: Number, default: 0 }, // Additional fixed late fee (for future use)
  
}, { timestamps: true });

// ✅ Compound index to prevent duplicate bills per user per month
PaymentSchema.index({ userId: 1, month: 1, year: 1, type: 1 }, { unique: true });

// ✅ Index for faster queries
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ meterNumber: 1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ dueDate: 1 }); // ✅ For penalty calculation queries
PaymentSchema.index({ isPenaltyApplied: 1 }); // ✅ For finding unpaid penalty bills

// ✅ Method to calculate and apply penalty
PaymentSchema.methods.applyPenalty = function(penaltyAmount, penaltyDays) {
  // Only apply penalty if bill is unpaid and penalty not already applied
  if (this.status === 'PAID' || this.isPenaltyApplied) {
    return { applied: false, reason: 'Already paid or penalty already applied' };
  }
  
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  
  // If not overdue, no penalty
  if (today <= dueDate) {
    return { applied: false, reason: 'Not overdue yet' };
  }
  
  // Calculate days overdue
  const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
  this.daysOverdue = daysOverdue;
  
  // Check if beyond grace period
  if (daysOverdue >= penaltyDays) {
    this.penaltyAmount = penaltyAmount;
    this.isPenaltyApplied = true;
    this.penaltyAppliedDate = today;
    this.lateFee = 0; // Reset late fee if any
    
    return { 
      applied: true, 
      penaltyAmount: penaltyAmount,
      daysOverdue: daysOverdue,
      totalDue: this.amount + penaltyAmount
    };
  }
  
  return { applied: false, reason: `Within grace period (${daysOverdue}/${penaltyDays} days)` };
};

// ✅ Method to get total amount including penalty
PaymentSchema.methods.getTotalAmount = function() {
  return this.amount + (this.penaltyAmount || 0) + (this.lateFee || 0);
};

// ✅ Method to check if bill has penalty
PaymentSchema.methods.hasPenalty = function() {
  return this.isPenaltyApplied && this.penaltyAmount > 0;
};

// ✅ Method to reset penalty (if admin waives it)
PaymentSchema.methods.resetPenalty = function() {
  this.penaltyAmount = 0;
  this.isPenaltyApplied = false;
  this.penaltyAppliedDate = null;
  this.daysOverdue = 0;
  this.lateFee = 0;
  return this;
};

// ✅ Virtual for formatted due date
PaymentSchema.virtual('formattedDueDate').get(function() {
  if (!this.dueDate) return 'N/A';
  return this.dueDate.toLocaleDateString('en-PH');
});

// ✅ Virtual for overdue status
PaymentSchema.virtual('isOverdue').get(function() {
  if (this.status === 'PAID') return false;
  return new Date() > new Date(this.dueDate);
});

// ✅ Virtual for total due (including penalty)
PaymentSchema.virtual('totalDue').get(function() {
  return this.amount + (this.penaltyAmount || 0) + (this.lateFee || 0);
});

// Ensure virtuals are included in JSON output
PaymentSchema.set('toJSON', { virtuals: true });
PaymentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Payment', PaymentSchema);