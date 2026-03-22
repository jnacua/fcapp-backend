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
    file: { 
        type: String, 
        default: null 
    },
    type: { 
        type: String, 
        enum: ['GENERAL', 'EMERGENCY', 'EVENT', 'BILLINGS'],
        default: 'GENERAL' 
    },
    // ✅ ADDED: status field to support ARCHIVING
    status: {
        type: String,
        enum: ['PUBLISHED', 'ARCHIVED', 'PENDING'],
        default: 'PUBLISHED'
    },
    // ✅ ADDED: isPinned field to support PINNING
    isPinned: {
        type: Boolean,
        default: false
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);