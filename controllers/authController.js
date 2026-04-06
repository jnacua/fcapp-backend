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
      role: role || 'resident',
      name, 
      mobileNumber, 
      blockLot,
      status: 'pending' // ✅ Set default status so they show up in Account Approval
    });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        name: user.name,
        blockLot: user.blockLot 
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

    res.json({
      message: 'Login successful',
      token: token,
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role, 
        name: user.name,
        status: user.status,
        blockLot: user.blockLot || user.blocklot || 'N/A',
        profileImage: user.profileImage || ''
      }
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= GET ALL USERS (FOR ADMIN) =================
// ✅ ADDED: This is what Flutter's AccountsScreen calls
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json(users);
  } catch (err) {
    console.error("GetAllUsers Error:", err);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// ================= UPDATE STATUS (FOR ADMIN) =================
// ✅ ADDED: This handles Approve/Reject/Archive
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { status: status.toLowerCase() }, 
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: `User status updated to ${status}`, user });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
};

// ================= GET ME (PROFILE) CONTROLLER =================
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); 

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      blockLot: user.blockLot || user.blocklot || 'N/A',
      profileImage: user.profileImage || '',
      mobileNumber: user.mobileNumber
    });
  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};