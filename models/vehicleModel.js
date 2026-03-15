const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vehicleType: { type: String, required: true },
    proofType: { type: String },
    licenseNumber: { type: String, required: true },
    proofImagePath: { type: String },
    carImagePath: { type: String },
    status: { type: String, default: 'Pending' },
    qrData: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Ensure 'Vehicle' matches what you call in the route
module.exports = mongoose.model('Vehicle', vehicleSchema);