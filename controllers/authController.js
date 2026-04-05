const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// ================= REGISTER CONTROLLER =================
exports.register = async (req, res) => {
  try {
    const { email, password, role, name, mobileNumber, blockLot } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      email, 
      password: hashedPassword, 
      role: role || 'resident', // Default role if not provided
      name, 
      mobileNumber, 
      blockLot 
    });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        name: user.name,
        blockLot: user.blockLot // Added here for immediate registration use
      },
      token: token 
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= LOGIN CONTROLLER =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // ✅ FIXED: Added blockLot and profileImage so Flutter receives them on login
    res.json({
      message: 'Login successful',
      token: token,
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role, 
        name: user.name,
        status: user.status,
        // Checks both CamelCase and lowercase to match your MongoDB data
        blockLot: user.blockLot || user.blocklot || 'N/A',
        profileImage: user.profileImage || ''
      }
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= GET ME (PROFILE) CONTROLLER =================
// This is what ApiService.getProfile() in Flutter calls
exports.getMe = async (req, res) => {
  try {
    // req.user.id is usually set by your 'protect' middleware
    const user = await User.findById(req.user.id).select('-password'); 

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ FIXED: Returns all fields needed for HomeScreen/ProfileScreen
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      // Ensures the address shows up even if it's named differently in DB
      blockLot: user.blockLot || user.blocklot || 'N/A',
      profileImage: user.profileImage || '',
      mobileNumber: user.mobileNumber
    });
  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};