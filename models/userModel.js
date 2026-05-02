const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        mobileNumber: { type: String },
        blockLot: { type: String },
        name: { type: String },
        proofOfResidencyPath: { type: String }, 
        
        // Profile image field
        profileImage: { type: String, default: '' }, 

        // Standardized statuses
        status: { 
            type: String, 
            enum: ['pending', 'approved', 'rejected', 'active', 'archived'], 
            default: 'pending' 
        },

        // Allows 'OWNER' or 'TENANT'
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

        // Password reset fields
        resetPasswordOTP: { type: String },
        resetPasswordExpires: { type: Date },
        
        // Original Owner fields (for TENANT type users)
        originalOwnerName: { 
            type: String, 
            default: '',
            trim: true 
        },
        originalOwnerContact: { 
            type: String, 
            default: '',
            trim: true 
        },
        originalOwnerEmail: { 
            type: String, 
            default: '',
            trim: true,
            lowercase: true
        },
        
        // Display name that combines tenant and original owner
        displayName: { 
            type: String, 
            default: '',
            trim: true 
        },
        
        // For linking tenant to original owner
        linkedToOwnerId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            default: null 
        },
        
        // Additional fields for tenant management
        moveInDate: { type: Date, default: null },
        leaseStartDate: { type: Date, default: null },
        leaseEndDate: { type: Date, default: null },
        monthlyRent: { type: Number, default: 0 },
        
        // Notes about the resident
        notes: { type: String, default: '' },
        
        // Emergency contact information
        emergencyContactName: { type: String, default: '' },
        emergencyContactNumber: { type: String, default: '' },
        emergencyContactRelation: { type: String, default: '' },
        
        // Is this user the primary resident
        isPrimary: { type: Boolean, default: true },
        
        // For family members linked to primary resident
        linkedToPrimaryId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            default: null 
        }
    },
    { timestamps: true }
);

// ✅ Create indexes for faster queries
userSchema.index({ email: 1 });
userSchema.index({ blockLot: 1 });
userSchema.index({ type: 1 });
userSchema.index({ status: 1 });
userSchema.index({ linkedToOwnerId: 1 });
userSchema.index({ linkedToPrimaryId: 1 });

// ✅ Virtual field to get full address
userSchema.virtual('fullAddress').get(function() {
    return this.blockLot || 'Address not set';
});

// ✅ Virtual field to get display name (prioritizes displayName if set)
userSchema.virtual('fullName').get(function() {
    if (this.displayName) return this.displayName;
    if (this.type === 'TENANT' && this.originalOwnerName) {
        return `${this.name} (Tenant of ${this.originalOwnerName})`;
    }
    return this.name || 'Unknown';
});

// ✅ Method to check if user is a tenant
userSchema.methods.isTenant = function() {
    return this.type === 'TENANT';
};

// ✅ Method to check if user is an owner
userSchema.methods.isOwner = function() {
    return this.type === 'OWNER';
};

// ✅ Method to get tenant info
userSchema.methods.getTenantInfo = function() {
    if (this.type === 'TENANT') {
        return {
            tenantName: this.name,
            originalOwner: this.originalOwnerName,
            originalOwnerContact: this.originalOwnerContact,
            originalOwnerEmail: this.originalOwnerEmail
        };
    }
    return null;
};

// ✅ Static method to find all tenants of an owner
userSchema.statics.findTenantsByOwnerName = function(ownerName) {
    return this.find({ 
        type: 'TENANT', 
        originalOwnerName: ownerName 
    });
};

// ✅ Static method to find all tenants by block/lot
userSchema.statics.findTenantsByBlockLot = function(blockLot) {
    return this.find({ 
        type: 'TENANT', 
        blockLot: blockLot 
    });
};

// ✅ FIXED: Pre-save middleware - removed 'next' parameter since we don't need it
userSchema.pre('save', function(next) {
    if (this.type === 'TENANT' && this.originalOwnerName) {
        this.displayName = `${this.name} (Tenant of ${this.originalOwnerName})`;
    } else if (this.name) {
        this.displayName = this.name;
    }
    next();
});

module.exports = mongoose.model('User', userSchema);