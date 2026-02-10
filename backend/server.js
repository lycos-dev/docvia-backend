const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { supabase, testConnection } = require('./config/supabase');
const authRoutes = require('./routes/auth.routes');

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('❌ Error: JWT_SECRET is not defined in .env file');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes (must come before catch-all route)
app.use('/api/auth', authRoutes);

// Health check endpoint for API
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Academic PDF Reader API - Authentication Service',
    version: '1.0.0',
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      'forgot-password': 'POST /api/auth/forgot-password',
      'reset-password': 'POST /api/auth/reset-password',
      google: 'GET /api/auth/google',
      'google-verify': 'POST /api/auth/google/verify',
      profile: 'GET /api/auth/profile (requires auth)',
      logout: 'POST /api/auth/logout (requires auth)'
    }
  });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  // Only serve HTML for non-API routes
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found'
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
const startServer = async () => {
  try {
    // Test Supabase connection
    console.log('🔄 Testing Supabase connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('⚠️  Warning: Could not verify Supabase connection');
      console.error('Please check your SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
    }

    app.listen(PORT, () => {
      console.log('================================');
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 Local: http://localhost:${PORT}`);
      console.log(`📍 Frontend: http://localhost:${PORT}`);
      console.log(`📝 API Docs: http://localhost:${PORT}/api`);
      console.log('================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;