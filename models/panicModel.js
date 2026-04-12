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
        // ✅ Updated enum to match your Flutter filtering logic ('Resolved' instead of 'Done')
        enum: ['Pending', 'Responding', 'Resolved'], 
        default: 'Pending' 
    },
    respondingUnit: { type: String, default: 'Waiting for dispatch...' }
}, { timestamps: true });

// ✅ CRITICAL FIX: The third argument 'panicalerts' ensures Mongoose 
// connects to the lowercase collection name seen in your Compass.
module.exports = mongoose.model('PanicAlert', panicSchema, 'panicalerts');