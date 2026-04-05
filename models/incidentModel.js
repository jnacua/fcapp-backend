const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    // Changed 'user' to 'userId' to match Flutter request.fields['userId']
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Added userName as a field so it saves directly without needing a population
    userName: {
        type: String,
        default: "Resident"
    },
    category: {
        type: String,
        required: true,
        // Match the Flutter list exactly (added 'Security', 'Maintenance', etc.)
        enum: ['Security', 'Maintenance', 'Noise', 'Medical', 'Others', 'Other']
    },
    description: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    // Matches the Multer logic we set up earlier
    incidentPhoto: {
        type: String 
    },
    status: {
        type: String,
        // Made this case-insensitive by adding both or sticking to one
        enum: ['pending', 'in-progress', 'resolved', 'Pending'], 
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Incident', incidentSchema);