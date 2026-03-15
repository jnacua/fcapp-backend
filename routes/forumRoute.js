const express = require('express');
const router = express.Router();
const Forum = require('../models/forumModel');
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'uploads/forum/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for Forum Images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `post-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// 1. CREATE POST (Homeowners & Admins)
router.post('/create', auth.protect, upload.single('image'), async (req, res) => {
    try {
        const { title, content } = req.body;
        
        // Check if user is Admin (matches casing from your other routes)
        const isAdmin = req.user.role === 'ADMIN';

        const newPost = new Forum({
            userId: req.user.id,
            title,
            content,
            image: req.file ? req.file.filename : null,
            // Logic: Admins create 'THREAD', Residents create 'POST'
            postType: isAdmin ? 'THREAD' : 'POST',
            // Logic: Admins are 'Approved' immediately, Residents are 'Pending'
            status: isAdmin ? 'Approved' : 'Pending'
        });

        await newPost.save();

        const responseMsg = isAdmin 
            ? "Thread published successfully!" 
            : "Post submitted for admin review!";

        res.status(201).json({ 
            message: responseMsg, 
            status: newPost.status,
            post: newPost 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. GET APPROVED POSTS (Main Feed)
router.get('/all', auth.protect, async (req, res) => {
    try {
        // Only show Approved posts. 
        // We also sort by postType so Threads (Admins) show up first if needed, 
        // then by newest date.
        const posts = await Forum.find({ status: 'Approved' })
            .populate('userId', 'name')
            .sort({ postType: 1, createdAt: -1 }); // 'THREAD' comes before 'POST' alphabetically
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. ADMIN ONLY: Get Pending Posts (For Approval Screen)
router.get('/pending', auth.protect, auth.restrictTo('ADMIN'), async (req, res) => {
    try {
        const pendingPosts = await Forum.find({ status: 'Pending' })
            .populate('userId', 'name')
            .sort({ createdAt: -1 });
        res.json(pendingPosts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. ADMIN ONLY: Approve/Reject Post
router.patch('/review/:postId', auth.protect, auth.restrictTo('ADMIN'), async (req, res) => {
    try {
        const { status } = req.body; // Expecting 'Approved' or 'Rejected'
        const post = await Forum.findByIdAndUpdate(
            req.params.postId, 
            { status }, 
            { new: true }
        );
        res.json({ message: `Post status updated to ${status}`, post });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. COMMENT ON POST (Both Residents and Admins)
router.post('/comment/:postId', auth.protect, async (req, res) => {
    try {
        const { text, userName } = req.body;
        const post = await Forum.findById(req.params.postId);
        
        if (!post) return res.status(404).json({ message: "Post not found" });

        post.comments.push({ 
            userId: req.user.id, 
            userName: userName || req.user.name, // Fallback to user name from auth if not provided
            text 
        });
        
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. LIKE/UNLIKE POST
router.post('/like/:postId', auth.protect, async (req, res) => {
    try {
        const post = await Forum.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (post.likes.includes(req.user.id)) {
            // Unlike
            post.likes = post.likes.filter(id => id.toString() !== req.user.id.toString());
        } else {
            // Like
            post.likes.push(req.user.id);
        }
        
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;