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

// ── Deadline cron job ──────────────────────────────────────────────
const { checkDeadlinesAndApplyPenalties, checkReminders } = require('./controllers/deadline.controller');

// Check deadlines every 15 minutes
setInterval(async () => {
  try {
    await checkReminders();
    await checkDeadlinesAndApplyPenalties();
  } catch (err) {
    console.error('[Cron] Deadline check error:', err.message);
  }
}, 15 * 60 * 1000); // 15 minutes

console.log('✅ Deadline checker scheduled (every 15 minutes)');

// ── CORS ───────────────────────────────────────────────────────────
// Build allowed origins: always include localhost for dev, plus the
// production Vercel URL from the env var (auto-fix missing https://).
const allowedOrigins = (() => {
  const origins = [
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  if (process.env.FRONTEND_URL) {
    let url = process.env.FRONTEND_URL.trim().replace(/\/$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    origins.push(url);
  }
  return origins;
})();

console.log('✅ CORS allowed origins:', allowedOrigins);

// Low-level middleware: manually write CORS headers on EVERY response.
// This runs before the cors() package so there is no chance of an
// invalid FRONTEND_URL value leaking into Access-Control-Allow-Origin.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  // Handle preflight immediately — no further middleware needed
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
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

// 404 handler for unknown API routes
app.get('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
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
function freePort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once('error', (err) => {
      if (err.code !== 'EADDRINUSE') return resolve();
      console.log(`⚠️  Port ${port} is in use — attempting to free it...`);
      try {
        if (process.platform === 'win32') {
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
            try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }); } catch (_) {}
          }
        } else {
          const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' });
          const pids = out.trim().split('\n').filter(Boolean);
          for (const pid of pids) {
            try { execSync(`kill -9 ${pid}`, { stdio: 'ignore' }); } catch (_) {}
          }
        }
      } catch (_) {}
      setTimeout(resolve, 500);
    });

    tester.once('listening', () => tester.close(resolve));
    tester.listen(port);
  });
}

// ── Start server ──────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await freePort(PORT);

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