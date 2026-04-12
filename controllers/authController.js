const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); 

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ FIXED: Correctly defined the helper function
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    auth: {
      user: 'nacuapaolo@gmail.com',
      pass: process.env.EMAIL_PASS 
    },
    name: 'gmail.com',
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2"
    },
    connectionTimeout: 20000, 
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });
};

// ✅ Reusable Function to send Approval/Rejection emails
const sendStatusEmail = async (userEmail, userName, status) => {
  console.log(`\n--- 📧 EMAIL ATTEMPT START ---`);
  const statusLower = status.toLowerCase();
  const isApproved = statusLower === 'active' || statusLower === 'approved';
  const isRejected = statusLower === 'rejected';

  if (!isApproved && !isRejected) return;

  const transporter = createTransporter();
  const mailOptions = {
    from: `"FCAPP System" <nacuapaolo@gmail.com>`,
    to: userEmail,
    subject: isApproved ? "Account Approved - FCAPP" : "Account Status Update - FCAPP",
    html: `<h3>Account ${isApproved ? 'Approved' : 'Rejected'}</h3><p>Hello ${userName}, your account is now ${statusLower}.</p>`
  };

  try {
    await transporter.sendMail(mailOptions);
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

// ================= LOGIN CONTROLLER =================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`--- 📡 LOGIN ATTEMPT START: ${email} ---`);

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ STEP 1 FAIL: User not found in database.`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ STEP 2 FAIL: Password mismatch.`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const dbStatus = user.status ? user.status.toLowerCase() : 'pending';
    if (dbStatus === 'pending') {
      return res.status(403).json({ message: "Wait for admin approval" });
    }

    if (dbStatus === 'active' || dbStatus === 'approved') {
      const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        message: 'Login successful',
        token: token,
        user: { 
          id: user._id, email: user.email, role: user.role, name: user.name,
          status: user.status, blockLot: user.blockLot || 'N/A', profileImage: user.profileImage || ''
        }
      });
    }

    return res.status(403).json({ message: "Account restricted." });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login' });
  }
};

// ================= FORGOT PASSWORD: SEND OTP =================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: "User with this email does not exist." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 600000; 
    await user.save();

    // ✅ DEBUG LOG: If email fails, copy this code from your Render Logs!
    console.log(`-----------------------------------------`);
    console.log(`🔑 FORGOT PASS OTP FOR ${user.email}: ${otp}`);
    console.log(`-----------------------------------------`);

    const transporter = createTransporter();
    const mailOptions = {
      from: `"FCAPP System" <nacuapaolo@gmail.com>`,
      to: user.email,
      subject: "Your Password Reset Code - FCAPP",
      html: `<h2>Password Reset Request</h2>
             <p>Hello ${user.name},</p>
             <p>Your 6-digit verification code is: <b>${otp}</b></p>
             <p>This code expires in 10 minutes.</p>`
    };

    // We wrap sendMail in its own try/catch so the server doesn't 
    // crash if the connection times out.
    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ OTP email actually sent to ${user.email}`);
    } catch (mailErr) {
      console.error(`❌ NODEMAILER TIMEOUT: Email not sent, but OTP is in logs: ${mailErr.message}`);
    }

    // Always return 200 so the app moves to the next screen.
    // If the email doesn't arrive, check your Render logs for the code!
    res.status(200).json({ message: "Request processed." });

  } catch (err) {
    console.error("❌ Forgot Password Error:", err);
    res.status(500).json({ message: "Error sending OTP." });
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

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    res.status(200).json({ message: "OTP verified. Proceed to reset password." });
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

    if (!user) {
      return res.status(400).json({ message: "Session expired. Please try again." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log(`✅ Password reset success for ${email}`);
    res.status(200).json({ message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json({ message: "Reset error." });
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