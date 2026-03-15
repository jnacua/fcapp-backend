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
    // New: Distinguish between an Admin Thread and a Resident Post
    postType: { 
        type: String, 
        enum: ['THREAD', 'POST'], 
        default: 'POST' 
    },
    // Status logic:
    // 'Pending' (needs Admin review), 'Approved' (visible to all), 'Rejected'
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

// Indexing for faster searching of approved posts
forumSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Forum', forumSchema);