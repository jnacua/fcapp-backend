const jwt = require('jsonwebtoken');
const User = require('../models/userModel'); // Make sure to import your User model

exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // 1. Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // 2. Check if token exists
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, no valid token provided' 
      });
    }

    // 3. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid token. Please login again.' 
        });
      }
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false,
          message: 'Token expired. Please login again.' 
        });
      }
      throw jwtError;
    }

    // 4. Check if user still exists in database
    const currentUser = await User.findById(decoded.id || decoded.userId).select('-password');
    
    if (!currentUser) {
      return res.status(401).json({ 
        success: false,
        message: 'The user belonging to this token no longer exists.' 
      });
    }

    // 5. Check if user is active (not archived or banned)
    if (currentUser.status === 'archived' || currentUser.status === 'banned') {
      return res.status(403).json({ 
        success: false,
        message: 'Your account has been deactivated. Please contact support.' 
      });
    }

    // 6. Attach user to request object
    req.user = {
      id: currentUser._id,
      email: currentUser.email,
      role: currentUser.role,
      name: currentUser.name,
      status: currentUser.status,
      type: currentUser.type
    };
    
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed. Please login again.' 
    });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if user exists
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'You are not logged in. Please login first.' 
      });
    }

    // Check if user has required role (case-insensitive)
    const userRole = req.user.role?.toUpperCase();
    const allowedRoles = roles.map(r => r.toUpperCase());
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role || 'none'}` 
      });
    }
    
    next();
  };
};

// Optional: Helper middleware for specific role checks
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role?.toUpperCase() !== 'ADMIN') {
    return res.status(403).json({ 
      success: false,
      message: 'Admin access required' 
    });
  }
  next();
};

exports.isSecurity = (req, res, next) => {
  if (!req.user || req.user.role?.toUpperCase() !== 'SECURITY') {
    return res.status(403).json({ 
      success: false,
      message: 'Security access required' 
    });
  }
  next();
};

exports.isResident = (req, res, next) => {
  if (!req.user || req.user.role?.toUpperCase() !== 'RESIDENT') {
    return res.status(403).json({ 
      success: false,
      message: 'Resident access required' 
    });
  }
  next();
};