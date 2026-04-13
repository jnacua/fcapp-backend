const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
    // Full name of the visitor
    visitorName: { 
        type: String, 
        required: [true, 'Visitor name is required'],
        trim: true 
    },
    // Reason for the visit (e.g., "Delivery", "Social Visit")
    purpose: { 
        type: String, 
        required: [true, 'Purpose of visit is required'] 
    },
    // The name or house number of the resident being visited
    residentToVisit: { 
        type: String, 
        required: [true, 'Resident name/House No is required'] 
    },
    // Reference to the Security Guard/Admin who logged the visitor
    recordedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // Status of the visitor (e.g., if they have already left)
    status: {
        type: String,
        enum: ['Checked-In', 'Checked-Out'],
        default: 'Checked-In'
    },
    // Timestamp of entry
    entryTime: { 
        type: Date, 
        default: Date.now 
    },
    // Timestamp for when they leave (filled later)
    exitTime: { 
        type: Date 
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('VisitorLog', visitorSchema);