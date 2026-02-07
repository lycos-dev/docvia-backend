const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

/**
 * Middleware to verify JWT token and authenticate user
 * Add this to any route that requires authentication
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from Supabase to ensure they still exist
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token.'
      });
    }

    // Attach user info to request object
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      token: token
    };

    next(); // Continue to the route handler
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Authentication failed.'
    });
  }
};

module.exports = { authenticateToken };
