const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');

// GET all facilities (any user)
router.get('/', protect, (req, res) => {
  res.json([
    { id: 1, name: 'Gym', status: 'available' },
    { id: 2, name: 'Pool', status: 'maintenance' }
  ]);
});

// POST new facility (admin only)
router.post('/', protect, restrictTo('admin'), (req, res) => {
  const { name } = req.body;
  res.json({ id: Math.floor(Math.random() * 1000), name, createdBy: req.user.email });
});

module.exports = router;
