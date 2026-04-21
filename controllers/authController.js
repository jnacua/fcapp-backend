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
    
    // ✅ FIX: Include role in token with consistent field name
    const token = jwt.sign(
      { 
        id: user._id, 
        userId: user._id,  // For compatibility with both middleware versions
        role: user.role,
        email: user.email,
        name: user.name
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.status(201).json({ 
      message: 'Registered successfully', 
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        mobileNumber: user.mobileNumber,
        blockLot: user.blockLot,
        type: user.type,
        profileImage: user.profileImage
      }, 
      token 
    });
  } catch (err) {
    console.error("Register error:", err);
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
    if (dbStatus === 'pending') {
      return res.status(403).json({ message: "Wait for admin approval" });
    }
    if (dbStatus === 'rejected') {
      return res.status(403).json({ message: "Account rejected. Contact admin." });
    }
    
    // ✅ FIX: Include role in token with consistent field names
    const token = jwt.sign(
      { 
        id: user._id, 
        userId: user._id,  // For compatibility
        role: user.role,
        email: user.email,
        name: user.name
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    // ✅ Return COMPLETE user data with ALL fields
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name || '',
      role: user.role || 'resident',
      type: user.type || 'OWNER',
      status: user.status || 'pending',
      mobileNumber: user.mobileNumber || '',
      blockLot: user.blockLot || '',
      profileImage: user.profileImage || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    console.log("✅ User logged in:", userData.name, "Block/Lot:", userData.blockLot);
    
    res.json({ 
      message: 'Login successful', 
      token, 
      user: userData 
    });
  } catch (err) {
    console.error("Login error:", err);
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
    console.error("Forgot password error:", err);
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
    console.error("Verify OTP error:", err);
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
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Reset error." });
  }
};

// ================= GET PROFILE (FIXED - RETURNS COMPLETE USER DATA) =================
exports.getMe = async (req, res) => {
  try {
    // Get user ID from protect middleware (supports both formats)
    const userId = req.user.id || req.user.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID not found in token' 
      });
    }
    
    // Find user and exclude sensitive fields
    const user = await User.findById(userId)
      .select('-password -resetPasswordOTP -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Return COMPLETE user data with all fields
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || '',
        role: user.role || 'resident',
        type: user.type || 'OWNER',
        status: user.status || 'pending',
        mobileNumber: user.mobileNumber || '',
        blockLot: user.blockLot || '',
        profileImage: user.profileImage || '',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    console.error("❌ Get profile error:", err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================= UPDATE PROFILE (NEW) =================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { name, mobileNumber, blockLot } = req.body;
    
    // Build update object with only provided fields
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (mobileNumber !== undefined) updates.mobileNumber = mobileNumber;
    if (blockLot !== undefined) updates.blockLot = blockLot;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No fields to update' 
      });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordOTP -resetPasswordExpires');
    
    if (!updatedUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    console.log("✅ Profile updated for:", updatedUser.name);
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        type: updatedUser.type,
        status: updatedUser.status,
        mobileNumber: updatedUser.mobileNumber,
        blockLot: updatedUser.blockLot,
        profileImage: updatedUser.profileImage,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (err) {
    console.error("❌ Update profile error:", err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================= UPDATE PROFILE PICTURE =================
exports.updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: "No image provided" 
      });
    }
    
    const userId = req.user.id || req.user.userId;
    const imageUrl = req.file.path; // Cloudinary URL
    
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { profileImage: imageUrl }, 
      { new: true }
    ).select('-password -resetPasswordOTP -resetPasswordExpires');
    
    if (!updatedUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    console.log("✅ Profile picture updated for:", updatedUser.name);
    
    res.status(200).json({ 
      success: true,
      message: "Profile picture updated successfully", 
      profileImageUrl: imageUrl,
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        type: updatedUser.type,
        status: updatedUser.status,
        mobileNumber: updatedUser.mobileNumber,
        blockLot: updatedUser.blockLot,
        profileImage: updatedUser.profileImage
      }
    });
  } catch (error) {
    console.error("❌ Profile picture error:", error);
    res.status(500).json({ 
      success: false,
      error: "Upload failed" 
    });
  }
};

// ================= ADMIN ROUTES =================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password -resetPasswordOTP -resetPasswordExpires');
    res.status(200).json({
      success: true,
      users: users
    });
  } catch (err) {
    console.error("Get all users error:", err);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { status: status }, 
      { new: true }
    ).select('-password -resetPasswordOTP -resetPasswordExpires');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Send email notification
    sendStatusEmail(user.email, user.name, status);
    
    res.status(200).json({ 
      success: true,
      message: `Status updated to ${status}`, 
      user 
    });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ message: 'Update failed' });
  }
};

// ================= ADDITIONAL HELPER FUNCTIONS =================

// Update user role (admin only)
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['resident', 'admin', 'president', 'security', 'officer'];
    
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid role' 
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: role },
      { new: true }
    ).select('-password -resetPasswordOTP -resetPasswordExpires');
    
    if (!user) return res.status(404).json({ 
      success: false,
      message: 'User not found' 
    });
    
    res.status(200).json({ 
      success: true,
      message: `User role updated to ${role}`, 
      user 
    });
  } catch (err) {
    console.error("Update role error:", err);
    res.status(500).json({ 
      success: false,
      message: 'Update failed' 
    });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ 
      success: false,
      message: 'User not found' 
    });
    
    res.status(200).json({ 
      success: true,
      message: 'User deleted successfully' 
    });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ 
      success: false,
      message: 'Delete failed' 
    });
  }
};

// Get user by ID (admin only)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordOTP -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (err) {
    console.error("Get user by ID error:", err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Get user statistics (admin only)
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const approvedUsers = await User.countDocuments({ status: 'approved' });
    const rejectedUsers = await User.countDocuments({ status: 'rejected' });
    const admins = await User.countDocuments({ role: 'admin' });
    const security = await User.countDocuments({ role: 'security' });
    const residents = await User.countDocuments({ role: 'resident' });
    
    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        pendingUsers,
        approvedUsers,
        rejectedUsers,
        admins,
        security,
        residents
      }
    });
  } catch (err) {
    console.error("Get user stats error:", err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};