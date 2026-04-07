const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        mobileNumber: { type: String },
        blockLot: { type: String },
        name: { type: String },
        proofOfResidencyPath: { type: String }, 

        // ✅ UPDATED: Added 'active' and 'archived' to match your Flutter logic
        status: { 
            type: String, 
            enum: ['pending', 'approved', 'rejected', 'active', 'archived'], 
            default: 'pending' 
        },

        // ✅ ADDED: This was missing! It allows 'OWNER' or 'TENANT'
        type: {
            type: String,
            enum: ['OWNER', 'TENANT', 'N/A'],
            default: 'OWNER'
        },

        role: { 
            type: String, 
            enum: ['resident', 'admin', 'president', 'security'],
            default: 'resident'
        },
        resetOtp: { type: String },
        resetOtpExpires: { type: Date },
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);