const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        mobileNumber: { type: String },
        blockLot: { type: String },
        name: { type: String },
        proofOfResidencyPath: { type: String }, 
        
        // ✅ Added this because your Login Controller expects it
        profileImage: { type: String, default: '' }, 

        // ✅ Standardized statuses
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

        // ✅ SYNCED: Renamed to match the controller logic
        resetPasswordOTP: { type: String },
        resetPasswordExpires: { type: Date },
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);