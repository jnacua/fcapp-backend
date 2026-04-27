const mongoose = require('mongoose');

const visitorLogSchema = new mongoose.Schema({
    visitorName: { 
        type: String, 
        required: true,
        trim: true 
    },
    purpose: { 
        type: String, 
        default: 'Visit', 
        trim: true 
    },
    residentToVisit: { 
        type: String, 
        required: true,
        trim: true 
    },
    plateNumber: { 
        type: String, 
        default: 'N/A', 
        trim: true, 
        uppercase: true 
    },
    recordedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    recordedByName: { 
        type: String, 
        default: 'Security' 
    },
    entryTime: { 
        type: Date, 
        default: Date.now 
    },
    exitTime: { 
        type: Date, 
        default: null 
    },
    status: { 
        type: String, 
        enum: ['COMPLETED', 'ACTIVE', 'EXPIRED'], 
        default: 'COMPLETED' 
    },
    type: { 
        type: String, 
        default: 'VISITOR' 
    }
}, { 
    timestamps: true 
});

// Create indexes for faster queries
visitorLogSchema.index({ entryTime: -1 });
visitorLogSchema.index({ visitorName: 'text', residentToVisit: 'text' });

module.exports = mongoose.model('VisitorLog', visitorLogSchema);