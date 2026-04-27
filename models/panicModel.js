const mongoose = require('mongoose');

const panicSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    residentName: { 
        type: String, 
        required: true 
    },
    houseNo: { 
        type: String, 
        default: 'N/A' 
    },
    blockLot: { 
        type: String, 
        default: 'N/A' 
    },
    location: {
        latitude: { type: Number, default: 14.5995 },
        longitude: { type: Number, default: 120.9842 },
        address: { type: String, default: '' }
    },
    emergencyType: { 
        type: String, 
        default: 'Emergency Alert',
        enum: [
            'Emergency Alert',
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
    respondingUnit: { 
        type: String, 
        default: 'Waiting for dispatch...' 
    },
    message: { 
        type: String, 
        default: '' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    resolvedAt: { 
        type: Date, 
        default: null 
    },
    resolvedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }
}, { 
    timestamps: true 
});

// Add indexes for faster queries
panicSchema.index({ userId: 1, createdAt: -1 });
panicSchema.index({ status: 1 });
panicSchema.index({ createdAt: -1 });

// Add a method to format timestamp
panicSchema.methods.getFormattedTime = function() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let hour = this.createdAt.getHours();
    const minute = this.createdAt.getMinutes().toString().padStart(2, '0');
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${months[this.createdAt.getMonth()]} ${this.createdAt.getDate()}, ${this.createdAt.getFullYear()} - ${hour}:${minute} ${period}`;
};

module.exports = mongoose.model('PanicAlert', panicSchema, 'panicalerts');