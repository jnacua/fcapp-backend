const mongoose = require('mongoose');

const forumSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    content: { 
        type: String, 
        required: true 
    },
    image: { 
        type: String 
    }, 
    // ✅ ADDED: Matches your Admin UI "Topic" dropdown
    topic: {
        type: String,
        default: 'General'
    },
    // ✅ ADDED: Matches your Admin UI "Audience" dropdown
    audience: {
        type: String,
        default: 'All Residents'
    },
    postType: { 
        type: String, 
        enum: ['THREAD', 'POST'], 
        default: 'POST' 
    },
    status: { 
        type: String, 
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending' 
    }, 
    likes: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    comments: [{
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        userName: String,
        text: { 
            type: String, 
            required: true 
        },
        createdAt: { 
            type: Date, 
            default: Date.now 
        }
    }]
}, { timestamps: true });

forumSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Forum', forumSchema);