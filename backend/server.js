const express = require('express');
const cors = require('cors');
const path = require('path');
const net = require('net');
const { execSync } = require('child_process');
const pdfRoutes = require('./routes/pdf.routes');
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
app.use('/api/pdf', pdfRoutes);

// Health check endpoint for API
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Academic PDF Reader API - Authentication & PDF Management Service',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        'forgot-password': 'POST /api/auth/forgot-password',
        'reset-password': 'POST /api/auth/reset-password',
        google: 'GET /api/auth/google',
        'google-verify': 'POST /api/auth/google/verify',
        profile: 'GET /api/auth/profile (requires auth)',
        logout: 'POST /api/auth/logout (requires auth)'
      },
      pdf: {
        upload: 'POST /api/pdf/upload (with integrated validation)',
        list: 'GET /api/pdf/list',
        delete: 'DELETE /api/pdf/:filename'
      }
    }
  });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
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

// ── Port release helper ───────────────────────────────────────────────────────
// Checks if a port is in use and kills the occupying process (Windows + Unix).
function freePort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once('error', (err) => {
      if (err.code !== 'EADDRINUSE') return resolve(); // unknown error — let listen fail naturally
      console.log(`⚠️  Port ${port} is in use — attempting to free it...`);
      try {
        if (process.platform === 'win32') {
          // netstat output: "  TCP  0.0.0.0:3001  ...  LISTENING  <pid>"
          const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
          const lines = out.trim().split('\n');
          const pids = new Set();
          for (const line of lines) {
            if (!line.includes('LISTENING')) continue;
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') pids.add(pid);
          }
          for (const pid of pids) {
            try {
              execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
              console.log(`✅ Killed PID ${pid} holding port ${port}`);
            } catch (_) { /* already gone */ }
          }
        } else {
          // macOS / Linux
          const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' });
          const pids = out.trim().split('\n').filter(Boolean);
          for (const pid of pids) {
            try {
              execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
              console.log(`✅ Killed PID ${pid} holding port ${port}`);
            } catch (_) { /* already gone */ }
          }
        }
      } catch (_) {
        // findstr / lsof returned nothing — port may have freed itself
      }
      // Give the OS a moment to release the port
      setTimeout(resolve, 500);
    });

    tester.once('listening', () => tester.close(resolve)); // port is free
    tester.listen(port);
  });
}

// ── Start server ──────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // Free the port before binding (no-op if already free)
    await freePort(PORT);

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