const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for authenticated user
 */
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' } // Token expires in 24 hours
  );
};

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    // Register user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          created_at: new Date().toISOString()
        }
      }
    });

    if (error) {
      console.error('Supabase registration error:', error);
      
      // Handle specific Supabase errors
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        return res.status(400).json({
          success: false,
          error: 'This email is already registered. Please login instead.'
        });
      }
      
      if (error.message.includes('Email rate limit exceeded')) {
        return res.status(429).json({
          success: false,
          error: 'Too many registration attempts. Please wait a few minutes and try again.'
        });
      }
      
      if (error.message.includes('Invalid API key')) {
        return res.status(500).json({
          success: false,
          error: 'Server configuration error. Please contact support.'
        });
      }
      
      return res.status(400).json({
        success: false,
        error: error.message || 'Registration failed. Please try again.'
      });
    }

    // Generate JWT token
    const token = generateToken(data.user.id, data.user.email);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase login error:', error);
      
      if (error.message.includes('Invalid login credentials')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
      }
      
      if (error.message.includes('Email rate limit exceeded')) {
        return res.status(429).json({
          success: false,
          error: 'Too many login attempts. Please wait a few minutes and try again.'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: error.message || 'Invalid email or password.'
      });
    }

    // Generate our own JWT token
    const token = generateToken(data.user.id, data.user.email);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at,
          last_sign_in: data.user.last_sign_in_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
};

/**
 * Get user profile (protected route)
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    // req.user is set by authenticateToken middleware
    const userId = req.user.id;

    // Get user from Supabase
    const { data: { user }, error } = await supabase.auth.getUser(req.user.token);

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in: user.last_sign_in_at,
          email_confirmed: user.email_confirmed_at ? true : false
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile.'
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logout successful!'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Logout failed. Please try again.'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  logout
};