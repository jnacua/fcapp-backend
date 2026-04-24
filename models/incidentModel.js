const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        default: "Resident"
    },
    category: {
        type: String,
        required: true,
        // ✅ FIXED: Only enum values from the dropdown, Others handled separately
        enum: ['Security', 'Maintenance', 'Noise', 'Medical', 'Others']
    },
    // ✅ NEW: Stores the custom text when user selects "Others"
    otherCategory: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    incidentPhoto: {
        type: String
    },
    status: {
        type: String,
        // ✅ FIXED: Cleaned up duplicate/inconsistent status values
        enum: ['pending', 'in-progress', 'resolved'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Incident', incidentSchema);