const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    content: { 
        type: String, 
        required: true 
    },
    // Changed from 'category' to 'type' to match your Flutter app
    type: { 
        type: String, 
        enum: ['GENERAL', 'EMERGENCY', 'EVENT', 'BILLINGS'],
        default: 'GENERAL' 
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }
}, { timestamps: true }); // Adding timestamps is helpful for sorting

module.exports = mongoose.model('Announcement', announcementSchema);