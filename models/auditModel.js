const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  userRole: { type: String, enum: ['ADMIN', 'SECURITY', 'RESIDENT', 'OWNER'], default: 'ADMIN' },
  
  action: { 
    type: String, 
    enum: [
      'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE', 
      'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'VIEW',
      'GENERATE_BILL', 'PAYMENT_PROCESSED', 'UPLOAD', 'EXPORT',
      'BOOK', 'CANCEL_BOOKING', 'APPROVE_BOOKING',
      'REGISTER_VEHICLE', 'UPDATE_VEHICLE', 'DELETE_VEHICLE',
      'UPDATE_SETTINGS'
    ], 
    required: true 
  },
  
  entity: { 
    type: String, 
    enum: [
      'ANNOUNCEMENT', 'PAYMENT', 'FACILITY', 'FACILITY_BOOKING',
      'USER', 'VEHICLE', 'SETTINGS', 'BLOCK_LOT', 'COMMUNITY_POST',
      'INCIDENT_REPORT', 'PANIC_ALERT', 'MONTHLY_DUES', 'WATER_BILL',
      'FORUM_THREAD'  // ← ADD THIS LINE
    ], 
    required: true 
  },
  
  entityId: { type: String },
  entityName: { type: String },
  
  details: { type: String },
  changes: { type: Object },
  
  ipAddress: { type: String },
  userAgent: { type: String },
  
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' }
}, { timestamps: true });

// Indexes for faster queries
auditSchema.index({ timestamp: -1 });
auditSchema.index({ userId: 1 });
auditSchema.index({ action: 1 });
auditSchema.index({ entity: 1 });

module.exports = mongoose.model('Audit', auditSchema);