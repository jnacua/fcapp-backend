const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Security', 'Maintenance', 'Noise', 'Other']
    },
    description: {
        type: String,
        required: true
    },
    location: {
        type: String
    },
    image: {
        type: String // Stores the file path
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'resolved'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Incident', incidentSchema);