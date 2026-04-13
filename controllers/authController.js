const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); 

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * ✅ BREVO TRANSPORTER CONFIGURATION
 */
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 2525, 
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  },
  tls: {
    rejectUnauthorized: false
  }
});

// ✅ REUSABLE STATUS EMAIL
const sendStatusEmail = async (userEmail, userName, status) => {
  const statusLower = status.toLowerCase();
  
  const mailOptions = {
    from: `"FCAPP Support" <a7dd86001@smtp-brevo.com>`, 
    replyTo: "jeianpaolonacua07@gmail.com",
    to: userEmail,
    subject: `Account Status Update: ${statusLower.toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #2c3e50;">Account Update</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>Your account status has been updated to: <span style="color: #27ae60; font-weight: bold;">${statusLower}</span></p>
        <p>You can now log in to the FCAPP mobile application.</p>
        <br/>
        <p style="font-size: 12px; color: #7f8c8d;">This is an automated message from the FCAPP Management System.</p>
      </div>`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ SUCCESS: Status email sent!`);
  } catch (error) {
    console.error(`❌ NODEMAILER ERROR: ${error.message}`);
  }
};

// ================= REGISTER =================
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

// ================= LOGIN =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    const dbStatus = user.status ? user.status.toLowerCase() : 'pending';
    if (dbStatus === 'pending') return res.status(403).json({ message: "Wait for admin approval" });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 600000; 
    await user.save();

    console.log(`🔑 OTP FOR ${user.email}: ${otp}`);

    const mailOptions = {
      from: `"FCAPP Support" <a7dd86001@smtp-brevo.com>`, 
      replyTo: "jeianpaolonacua07@gmail.com",
      to: user.email,
      subject: `Verification Code: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 30px; border: 1px solid #ddd; border-radius: 8px; max-width: 500px; margin: auto;">
          <h2 style="color: #27ae60; text-align: center;">FCAPP Security</h2>
          <p>Hello ${user.name},</p>
          <p>Your verification code for password reset is:</p>
          <div style="background: #f9f9f9; border: 1px dashed #27ae60; padding: 15px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 8px; color: #333;">
            ${otp}
          </div>
          <p style="font-size: 13px; color: #666; text-align: center;">This code will expire in 10 minutes.</p>
        </div>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(`❌ BREVO ERROR: ${error.message}`);
      } else {
        console.log(`✅ SUCCESS: OTP sent to ${user.email}`);
      }
    });

    res.status(200).json({ message: "OTP generated successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error processing request." });
  }
};

// ================= VERIFY OTP =================
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() } 
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired OTP." });
    res.status(200).json({ message: "OTP verified." });
  } catch (err) {
    res.status(500).json({ message: "Verification error." });
  }
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ message: "Session expired." });
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.status(200).json({ message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json({ message: "Reset error." });
  }
};

// ================= ADMIN & PROFILE =================
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
    res.status(200).json({ message: `Status updated`, user });
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
  try {
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    const imageUrl = req.file.path;
    await User.findByIdAndUpdate(req.user.id, { profileImage: imageUrl }, { new: true });
    res.status(200).json({ message: "Success", profileImageUrl: imageUrl });
  } catch (error) {
    res.status(500).json({ error: "Upload failed" });
  }
};