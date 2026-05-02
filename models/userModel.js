const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        mobileNumber: { type: String, default: '' },
        blockLot: { type: String, default: '' },
        name: { type: String, default: '' },
        proofOfResidencyPath: { type: String, default: '' }, 
        profileImage: { type: String, default: '' }, 
        
        status: { 
            type: String, 
            enum: ['pending', 'approved', 'rejected', 'active', 'archived'], 
            default: 'pending' 
        },
        
        type: {
            type: String,
            enum: ['OWNER', 'TENANT', 'N/A'],
            default: 'OWNER'
        },
        
        role: { 
            type: String, 
            enum: ['resident', 'admin', 'president', 'security', 'officer'],
            default: 'resident'
        },
        
        resetPasswordOTP: { type: String, default: null },
        resetPasswordExpires: { type: Date, default: null },
        
        // Original Owner fields for TENANT
        originalOwnerName: { type: String, default: '' },
        originalOwnerContact: { type: String, default: '' },
        originalOwnerEmail: { type: String, default: '' },
        displayName: { type: String, default: '' },
        
        // Additional fields (optional, remove if causing issues)
        linkedToOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        moveInDate: { type: Date, default: null },
        leaseStartDate: { type: Date, default: null },
        leaseEndDate: { type: Date, default: null },
        monthlyRent: { type: Number, default: 0 },
        notes: { type: String, default: '' }
    },
    { timestamps: true }
);

// ✅ NO PRE-SAVE MIDDLEWARE - Comment out or delete any userSchema.pre() lines
// DO NOT add any userSchema.pre('save', ...) here

// Simple indexes
userSchema.index({ email: 1 });
userSchema.index({ blockLot: 1 });
userSchema.index({ type: 1 });
userSchema.index({ status: 1 });

// Simple methods (no middleware)
userSchema.methods.isTenant = function() {
    return this.type === 'TENANT';
};

userSchema.methods.isOwner = function() {
    return this.type === 'OWNER';
};

// ✅ NO virtual fields that might cause issues

module.exports = mongoose.model('User', userSchema);