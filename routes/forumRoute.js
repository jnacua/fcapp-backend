const express = require('express');
const router = express.Router();
const Forum = require('../models/forumModel');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ==========================================
// 0. CLOUDINARY CONFIG
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

// ✅ Consistent Key: Matches Flutter 'image' field
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ==========================================
// 1. CREATE POST (Logic: Residents = Pending, Admin = Approved)
// ==========================================
router.post('/create', protect, upload.single('image'), async (req, res) => {
    try {
        const { title, content, topic, audience } = req.body;
        const isAdmin = req.user && req.user.role.toUpperCase() === 'ADMIN';

        const newPost = new Forum({
            userId: req.user.id,
            title: title || "Untitled Thread",
            content: content,
            // ✅ Cloudinary URL saved to 'image' field
            image: req.file ? req.file.path : null, 
            topic: topic || 'GENERAL',
            audience: audience || 'ALL RESIDENTS',
            // Only Admins can create 'THREAD', Residents create 'POST'
            postType: isAdmin ? 'THREAD' : 'POST',
            // Residents MUST be approved by Admin first
            status: isAdmin ? 'Approved' : 'Pending'
        });

        await newPost.save();

        const responseMsg = isAdmin 
            ? "Thread published successfully!" 
            : "Post submitted! It will appear once an Admin approves it.";

        console.log("✅ Forum Post Created. Cloudinary path:", newPost.image);

        res.status(201).json({ 
            message: responseMsg, 
            status: newPost.status,
            post: newPost 
        });
    } catch (err) {
        console.error("❌ Forum Create Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. GET POSTS (Residents see Approved, Admins see All)
// ==========================================
router.get('/all', protect, async (req, res) => {
    try {
        let query = {};

        // If user is NOT an admin, only show approved posts
        if (req.user.role.toUpperCase() !== 'ADMIN') {
            query = { status: { $regex: /^approved$/i } };
        } 

        const posts = await Forum.find(query)
            .populate('userId', 'name')
            .sort({ createdAt: -1 }); 
            
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. COMMENT / REPLY LOGIC
// ==========================================
router.post('/comment/:postId', protect, async (req, res) => {
    try {
        const { text, parentCommentId } = req.body; 
        const post = await Forum.findById(req.params.postId);
        
        if (!post) return res.status(404).json({ message: "Post not found" });

        // If parentCommentId is provided, it's a REPLY
        if (parentCommentId) {
            const parentComment = post.comments.id(parentCommentId);
            if (!parentComment) return res.status(404).json({ message: "Original comment not found" });

            parentComment.replies.push({
                userId: req.user.id,
                userName: req.user.name, 
                text: text
            });
        } else {
            // Standard top-level Comment
            post.comments.push({ 
                userId: req.user.id, 
                userName: req.user.name, 
                text: text 
            });
        }
        
        await post.save();
        res.status(200).json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 4. ADMIN ONLY: Review Post (Approve/Reject/Archive)
// ==========================================
router.patch('/review/:postId', protect, restrictTo('ADMIN'), async (req, res) => {
    try {
        const { status } = req.body; 
        
        const validStatuses = ['Approved', 'Rejected', 'Pending', 'Archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status provided" });
        }

        const post = await Forum.findByIdAndUpdate(
            req.params.postId, 
            { status }, 
            { new: true }
        );

        if (!post) return res.status(404).json({ message: "Post not found" });

        res.json({ message: `Post marked as ${status}`, post });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. ADMIN ONLY: Get Pending Posts
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
// 6. LIKE/UNLIKE POST
// ==========================================
router.post('/like/:postId', protect, async (req, res) => {
    try {
        const post = await Forum.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const userIdString = req.user.id.toString();
        const index = post.likes.indexOf(userIdString);

        if (index > -1) {
            post.likes.splice(index, 1); 
        } else {
            post.likes.push(userIdString);
        }
        
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;