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
    emergencyType: { 
        type: String, 
        default: 'Emergency Alert',
        enum: [
            'Medical Emergency',
            'Fire Emergency',
            'Security Threat',
            'Accident',
            'Natural Disaster',
            'Heart Attack',
            'Stroke',
            'Difficulty Breathing',
            'Severe Bleeding',
            'Unconscious Person',
            'Seizure',
            'Choking',
            'Drowning',
            'Electric Shock',
            'Carbon Monoxide Poisoning',
            'Assault',
            'Theft / Robbery',
            'Active Shooter',
            'Suspicious Person',
            'Vandalism',
            'Structure Fire',
            'Wildfire',
            'Gas Leak',
            'Flooding',
            'Earthquake',
            'Typhoon / Storm',
            'Landslide',
            'Power Outage',
            'Domestic Disturbance',
            'Child in Danger',
            'Elderly Fall',
            'Missing Person',
            'Suicide Threat'
        ]
    },
    status: { 
        type: String, 
        enum: ['Pending', 'Responding', 'Resolved'], 
        default: 'Pending' 
    },
    respondingUnit: { type: String, default: 'Waiting for dispatch...' }
}, { timestamps: true });

// Add index for faster queries
panicSchema.index({ userId: 1, createdAt: -1 });
panicSchema.index({ status: 1 });

module.exports = mongoose.model('PanicAlert', panicSchema, 'panicalerts');