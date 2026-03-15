const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        mobileNumber: { type: String },
        blockLot: { type: String },
        name: { type: String },
        proofOfResidencyPath: { type: String }, 

        // ADDED: Approval Status
        status: { 
            type: String, 
            enum: ['pending', 'approved', 'rejected'], 
            default: 'pending' 
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