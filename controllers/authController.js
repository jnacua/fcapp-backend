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
  console.log(`Recipient: ${userEmail}`);
  console.log(`Status Input: ${status}`);

  const statusLower = status.toLowerCase();
  const isApproved = statusLower === 'active' || statusLower === 'approved';
  const isRejected = statusLower === 'rejected';

  if (!isApproved && !isRejected) {
    console.log(`⚠️ Email Skipped: Status "${statusLower}" is not a trigger status.`);
    return;
  }

  const mailOptions = {
    from: `"FCAPP System" <nacuapaolo@gmail.com>`,
    to: userEmail,
    subject: isApproved ? "Account Approved - FCAPP" : "Account Status Update - FCAPP",
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; max-width: 600px; border-radius: 10px;">
        <div style="background-color: ${isApproved ? '#176F63' : '#d9534f'}; color: white; padding: 10px; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin:0;">Account ${isApproved ? 'Approved' : 'Rejected'}</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
          <p>Hello <b>${userName}</b>,</p>
          <p>Your account registration for the <b>Fiesta Casitas Subdivision App</b> has been <b>${statusLower}</b> by the administrator.</p>
          ${isApproved 
            ? '<p>You can now log in using your registered credentials to access billing, announcements, and community features.</p>' 
            : '<p>Unfortunately, your registration could not be verified at this time. If you believe this is an error, please visit the HOA office for assistance.</p>'}
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 11px; color: #888; text-align: center;">Fiesta Casitas HOA Management Team</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ SUCCESS: Status email sent! MessageID: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ NODEMAILER ERROR: ${error.message}`);
    console.log("⚠️ Continuing process without email...");
  }
};

// ================= REGISTER CONTROLLER =================
exports.register = async (req, res) => {
  try {
    const { email, password, role, name, mobileNumber, blockLot } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      email, 
      password: hashedPassword, 
      role: role || 'resident',
      name, 
      mobileNumber, 
      blockLot, 
      status: 'pending' 
    });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user._id, email: user.email, role: user.role, name: user.name },
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
    console.log(`📡 Login request for: ${email}`);

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // ✅ CASE-INSENSITIVE STATUS CHECK
    // This allows "APPROVED", "Approved", or "active" to work.
    const currentStatus = user.status ? user.status.toLowerCase() : 'pending';

    if (currentStatus === 'pending') {
      return res.status(403).json({ message: "Wait for admin approval" });
    }

    // Allow entry only if status is approved or active
    if (currentStatus !== 'active' && currentStatus !== 'approved') {
        return res.status(403).json({ message: "Account is restricted." });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    console.log(`✅ Login Success: ${user.name}`);
    res.json({
      message: 'Login successful',
      token: token,
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,  
        name: user.name,
        status: user.status,
        blockLot: user.blockLot || 'N/A',
        profileImage: user.profileImage || ''
      }
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// ================= ADMIN CONTROLLERS =================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json(users);
  } catch (err) {
    console.error("GetAllUsers Error:", err);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { status: status }, // Keep capitalization for DB visibility if preferred
      { new: true }
    );
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    sendStatusEmail(user.email, user.name, status);

    res.status(200).json({ message: `User status updated to ${status}`, user });
  } catch (err) {
    console.error("UpdateStatus Controller Error:", err);
    res.status(500).json({ message: 'Update failed' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); 
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= UPDATE PROFILE PICTURE (CLOUDINARY) =================
exports.updateProfilePicture = async (req, res) => {
  console.log("--- 📸 PROFILE UPLOAD START ---");
  try {
    if (!req.file) {
      console.log("❌ DEBUG: No file found in req.file. Check Multer config.");
      return res.status(400).json({ error: "No image file provided" });
    }

    console.log("✅ DEBUG: File received from Multer:", req.file.path);
    console.log("✅ DEBUG: Authenticated User ID:", req.user.id);

    const imageUrl = req.file.path;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      { profileImage: imageUrl }, 
      { new: true }
    );

    if (!updatedUser) {
      console.log("❌ DEBUG: User not found in DB during update.");
      return res.status(404).json({ message: 'User not found' });
    }

    console.log("✅ DEBUG: MongoDB updated for:", updatedUser.name);
    console.log("--- 📸 PROFILE UPLOAD SUCCESS ---");

    res.status(200).json({ 
      message: "Success", 
      profileImageUrl: imageUrl 
    });
  } catch (error) {
    console.error("❌ DEBUG: Upload Error:", error.message);
    res.status(500).json({ error: "Server error during image upload" });
  }
};