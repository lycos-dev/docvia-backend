const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  register, login, signUp, signIn,
  forgotPassword, resetPassword,
  googleSignIn, googleVerify,
  getProfile, logout,
  saveGroqKey, deleteGroqKey, getGroqKeyStatus,
} = require('../controllers/auth.controller');

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/register',        register);
router.post('/signup',          signUp);
router.post('/login',           login);
router.post('/signin',          signIn);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);
router.get('/google',           googleSignIn);
router.post('/google/verify',   googleVerify);

// ── Protected routes ──────────────────────────────────────────────────────────
router.get('/profile',          authenticateToken, getProfile);
router.post('/logout',          authenticateToken, logout);

// ── Groq API key management ───────────────────────────────────────────────────
router.get('/groq-key',         authenticateToken, getGroqKeyStatus);
router.put('/groq-key',         authenticateToken, saveGroqKey);
router.delete('/groq-key',      authenticateToken, deleteGroqKey);

module.exports = router;