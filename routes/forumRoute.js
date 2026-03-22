const express = require('express');
const router = express.Router();
const Forum = require('../models/forumModel');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ==========================================
// 0. CLOUDINARY CONFIGURATION
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'community_forum', 
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 1000, crop: 'limit' }]
  },
});

const upload = multer({ storage: storage });

// ==========================================
// 1. CREATE POST (Homeowners & Admins)
// ==========================================
router.post('/create', protect, upload.single('image'), async (req, res) => {
    try {
        const { title, content, topic, audience } = req.body;
        
        // Safety check for user and role
        const isAdmin = req.user && req.user.role === 'ADMIN';

        const newPost = new Forum({
            userId: req.user.id,
            title: title || "Untitled Thread",
            content: content,
            // ✅ FIX: Only access .path if req.file exists to avoid 500 error
            image: req.file ? req.file.path : null, 
            topic: topic || 'General',
            audience: audience || 'All Residents',
            postType: isAdmin ? 'THREAD' : 'POST',
            // Force Admin posts to be Approved immediately
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
        console.error("❌ FORUM CREATE ERROR:", err);
        res.status(500).json({ 
            message: "Server error during post creation", 
            error: err.message 
        });
    }
});

// ==========================================
// 2. GET APPROVED POSTS (Main Feed for Mobile)
// ==========================================
router.get('/all', protect, async (req, res) => {
    try {
        // Fetch posts where status is 'Approved' (case-insensitive check is safer)
        const posts = await Forum.find({ 
            status: { $regex: /^approved$/i } 
        })
        .populate('userId', 'name')
        .sort({ createdAt: -1 }); 
        
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. ADMIN ONLY: Get Pending Posts
// ==========================================
router.get('/pending', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const pendingPosts = await Forum.find({ status: 'Pending' })
            .populate('userId', 'name')
            .sort({ createdAt: -1 });
        res.json(pendingPosts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 4. ADMIN ONLY: Approve/Reject Post
// ==========================================
router.patch('/review/:postId', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { status } = req.body; 
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

// ==========================================
// 5. COMMENT ON POST
// ==========================================
router.post('/comment/:postId', protect, async (req, res) => {
    try {
        const { text, userName } = req.body;
        const post = await Forum.findById(req.params.postId);
        
        if (!post) return res.status(404).json({ message: "Post not found" });

        post.comments.push({ 
            userId: req.user.id, 
            userName: userName || req.user.name, 
            text: text 
        });
        
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 6. LIKE/UNLIKE POST
// ==========================================
router.post('/like/:postId', protect, async (req, res) => {
    try {
        const post = await Forum.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const userIdString = req.user.id.toString();
        const index = post.likes.indexOf(userIdString);

        if (index > -1) {
            post.likes.splice(index, 1); // Unlike
        } else {
            post.likes.push(userIdString); // Like
        }
        
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;