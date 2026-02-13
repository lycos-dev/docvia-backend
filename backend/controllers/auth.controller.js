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
 * Forgot Password - Send reset email
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required.'
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

    // Send password reset email via Supabase
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
      console.error('Supabase forgot password error:', error);
      
      // For security, don't reveal if email exists or not
      // Return success message regardless
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process password reset request. Please try again.'
    });
  }
};

/**
 * Reset Password - Update password with reset token
 * POST /api/auth/reset-password
 * 
 * The token comes from the email link and is an access_token JWT
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validation
    if (!token || !newPassword) {
      console.error('❌ Missing token or password');
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required.'
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    console.log('🔄 Processing password reset...');
    console.log('Token length:', token.length);

    // Make a direct API call to Supabase to update the password
    // using the access token from the password reset email
    const updateUrl = `${process.env.SUPABASE_URL}/auth/v1/user`;
    
    console.log('📡 Calling Supabase API...');
    console.log('URL:', updateUrl);

    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        password: newPassword
      })
    });

    console.log('📊 Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API error response:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset link. Please request a new password reset.'
      });
    }

    const result = await response.json();
    console.log('✅ Password updated successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });

  } catch (error) {
    console.error('❌ Reset password exception:', error.message);
    console.error('Full error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.'
    });
  }
};

/**
 * Google Sign-In - Initiate OAuth flow
 * GET /api/auth/google
 */
const googleSignIn = async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3001'}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) {
      console.error('Google OAuth initiation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to initiate Google sign-in.'
      });
    }

    // Return the OAuth URL for the frontend to redirect to
    return res.status(200).json({
      success: true,
      data: {
        url: data.url
      }
    });
  } catch (error) {
    console.error('Google sign-in error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to initiate Google sign-in.'
    });
  }
};

/**
 * Verify Google OAuth Session
 * POST /api/auth/google/verify
 */
const googleVerify = async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required.'
      });
    }

    // Get user from Supabase using the access token
    const { data: { user }, error } = await supabase.auth.getUser(access_token);

    if (error || !user) {
      console.error('Google OAuth verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Failed to verify Google sign-in.'
      });
    }

    // Generate our own JWT token
    const token = generateToken(user.id, user.email);

    return res.status(200).json({
      success: true,
      message: 'Google sign-in successful!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email,
          avatar: user.user_metadata?.avatar_url || null,
          created_at: user.created_at,
          last_sign_in: user.last_sign_in_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Google verify error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify Google sign-in.'
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
    const userEmail = req.user.email;

    // For a more complete profile, query Supabase auth users
    // Using the supabase client to list users (requires admin privileges)
    // For now, we'll return the basic info from JWT
    
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: userId,
          email: userEmail,
          created_at: new Date().toISOString(),
          last_sign_in: new Date().toISOString(),
          email_confirmed: false
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

// Aliases for alternative naming
const signUp = register;
const signIn = login;

module.exports = {
  register,
  login,
  signUp,
  signIn,
  forgotPassword,
  resetPassword,
  googleSignIn,
  googleVerify,
  getProfile,
  logout
};