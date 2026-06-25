const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Handle different JWT errors
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Authentication token expired.' });
      }
      return res.status(403).json({ message: 'Invalid authentication token.' });
    }
    req.user = user; // Attach user payload to the request
    next();
  });
};

// Optional: Middleware for role-based access control
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role_name) {
      return res.status(403).json({ message: 'Access denied. User role not found.' });
    }
    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles
};
