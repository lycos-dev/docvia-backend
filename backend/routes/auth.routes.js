const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleSignIn,
  googleVerify,
  getProfile,
  logout
} = require('../controllers/auth.controller');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', resetPassword);

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth sign-in
 * @access  Public
 */
router.get('/google', googleSignIn);

/**
 * @route   POST /api/auth/google/verify
 * @desc    Verify Google OAuth token and get JWT
 * @access  Public
 */
router.post('/google/verify', googleVerify);

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Private (requires authentication)
 */
router.get('/profile', authenticateToken, getProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private (requires authentication)
 */
router.post('/logout', authenticateToken, logout);

module.exports = router;