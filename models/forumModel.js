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
        type: String // This will store the Cloudinary URL (https://...)
    }, 
    topic: {
        type: String,
        default: 'General'
    },
    audience: {
        type: String,
        default: 'All Residents'
    },
    // Distinguishes between Admin (THREAD) and Resident (POST)
    postType: { 
        type: String, 
        enum: ['THREAD', 'POST'], 
        default: 'POST' 
    },
    // Approval system: Only 'Approved' posts show up on the Mobile Feed
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
        userName: String, // Populated from req.user.name during creation
        text: { 
            type: String, 
            required: true 
        },
        // ✅ NESTED REPLIES: Allows users to reply to specific comments
        replies: [{
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
        }],
        createdAt: { 
            type: Date, 
            default: Date.now 
        }
    }]
}, { timestamps: true });

// Optimizes queries for the feed (Filtering by status and sorting by date)
forumSchema.index({ status: 1, createdAt: -1 });
// Optimizes queries that separate Threads from Posts
forumSchema.index({ postType: 1 });

module.exports = mongoose.model('Forum', forumSchema);