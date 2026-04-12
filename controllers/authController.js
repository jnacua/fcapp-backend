const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); 

const JWT_SECRET = process.env.JWT_SECRET;

// ================= EMAIL CONFIGURATION (GMAIL) =================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nacuapaolo@gmail.com',
    pass: process.env.EMAIL_PASS 
  }
});

// ✅ Reusable Function to send Approval/Rejection emails
const sendStatusEmail = async (userEmail, userName, status) => {
  console.log(`\n--- 📧 EMAIL ATTEMPT START ---`);
  const statusLower = status.toLowerCase();
  const isApproved = statusLower === 'active' || statusLower === 'approved';
  const isRejected = statusLower === 'rejected';

  if (!isApproved && !isRejected) return;

  const mailOptions = {
    from: `"FCAPP System" <nacuapaolo@gmail.com>`,
    to: userEmail,
    subject: isApproved ? "Account Approved - FCAPP" : "Account Status Update - FCAPP",
    html: `<h3>Account ${isApproved ? 'Approved' : 'Rejected'}</h3><p>Hello ${userName}, your account is now ${statusLower}.</p>`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ SUCCESS: Status email sent!`);
  } catch (error) {
    console.error(`❌ NODEMAILER ERROR: ${error.message}`);
  }
};

// ================= REGISTER CONTROLLER =================
exports.register = async (req, res) => {
  try {
    const { email, password, role, name, mobileNumber, blockLot } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      email, password: hashedPassword, role: role || 'resident',
      name, mobileNumber, blockLot, status: 'pending' 
    });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Registered successfully', user, token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= LOGIN CONTROLLER (WITH DIAGNOSTICS) =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`--- 📡 LOGIN ATTEMPT START: ${email} ---`);

    // STEP 1: DB LOOKUP
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ STEP 1 FAIL: User not found in database.`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    console.log(`✅ STEP 1 PASS: User found (${user.name})`);

    // STEP 2: PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ STEP 2 FAIL: Password mismatch.`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    console.log(`✅ STEP 2 PASS: Password matches`);

    // STEP 3: STATUS VERIFICATION
    const dbStatus = user.status ? user.status.toLowerCase() : 'pending';
    console.log(`🔍 STEP 3 CHECK: Database status is "${dbStatus}"`);

    if (dbStatus === 'pending') {
      console.log(`❌ STEP 3 FAIL: Account is pending.`);
      return res.status(403).json({ message: "Wait for admin approval" });
    }

    if (dbStatus === 'active' || dbStatus === 'approved') {
      console.log(`✅ STEP 3 PASS: Status accepted.`);
      
      // STEP 4: JWT GENERATION
      const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      console.log(`✅ STEP 4 PASS: Token generated. Sending success response.`);

      return res.json({
        message: 'Login successful',
        token: token,
        user: { 
          id: user._id, email: user.email, role: user.role, name: user.name,
          status: user.status, blockLot: user.blockLot || 'N/A', profileImage: user.profileImage || ''
        }
      });
    }

    console.log(`❌ STEP 3 FAIL: Status "${dbStatus}" not recognized.`);
    return res.status(403).json({ message: "Account restricted." });

  } catch (err) {
    console.error("❌ CRITICAL LOGIN ERROR:", err.stack);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// ================= ADMIN & PROFILE CONTROLLERS =================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { status: status }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    sendStatusEmail(user.email, user.name, status);
    res.status(200).json({ message: `Status updated to ${status}`, user });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); 
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfilePicture = async (req, res) => {
  console.log("--- 📸 PROFILE UPLOAD START ---");
  try {
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    const imageUrl = req.file.path;
    const updatedUser = await User.findByIdAndUpdate(req.user.id, { profileImage: imageUrl }, { new: true });
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: "Success", profileImageUrl: imageUrl });
  } catch (error) {
    res.status(500).json({ error: "Upload failed" });
  }
};