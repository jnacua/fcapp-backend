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
    req.user = decoded; // This typically contains { id, role }
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: 'Token is malformed or invalid' });
  }
};

// --- ADD THIS SECTION TO FIX THE CRASH ---
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if the user's role (from the decoded token) is allowed
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'You do not have permission to perform this action' 
      });
    }
    next();
  };
};