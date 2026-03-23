const jwt = require('jsonwebtoken');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token || token === 'null') {
      return res.status(401).json({ message: 'Not authorized, no valid token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ✅ Attach user info to req.user
    req.user = decoded; 
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    res.status(401).json({ message: 'Token is malformed or invalid' });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // ✅ Ensure req.user exists and role check is case-insensitive
    if (!req.user || !req.user.role || !roles.map(r => r.toUpperCase()).includes(req.user.role.toUpperCase())) {
      return res.status(403).json({ 
        message: 'You do not have permission to perform this action' 
      });
    }
    next();
  };
};