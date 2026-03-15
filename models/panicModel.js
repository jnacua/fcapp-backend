const mongoose = require('mongoose');

const panicSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    residentName: String,
    houseNo: String,
    location: {
        latitude: Number,
        longitude: Number,
        address: String // Optional: reverse geocoded address
    },
    status: { 
        type: String, 
        enum: ['Pending', 'Responding', 'Done'], 
        default: 'Pending' 
    },
    respondingUnit: { type: String, default: 'Waiting for dispatch...' }
}, { timestamps: true });

module.exports = mongoose.model('PanicAlert', panicSchema);