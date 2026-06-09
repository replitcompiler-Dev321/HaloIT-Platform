require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { sequelize } = require('./db/models');

// Import middleware
const { authenticate, optionalAuth } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const mfaRoutes = require('./routes/mfa');
const usersRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const dashboardRoutes = require('./routes/dashboard');
const ticketRoutes = require('./routes/tickets');
const clientRoutes = require('./routes/clients');
const slaRoutes = require('./routes/sla');
const clientPortalRoutes = require('./routes/clientPortal');
const monitoringRoutes = require('./routes/monitoring');

// Import services
const monitoringService = require('./services/monitoring');

// Import AI service (existing)
const { handleAiAction, getAiSettings, updateAiSettings } = require('./ai/aiService');

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Halo Backend Running - Phase 1 Core Platform',
    timestamp: new Date().toISOString(),
  });
});

// Clean up any leftover SQLite backup tables from previous alter operations
const dropStaleBackupTables = async () => {
  if (sequelize.getDialect() === 'sqlite') {
    const [tables] = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup'"
    );
    for (const table of tables) {
      if (table.name) {
        await sequelize.query(`DROP TABLE IF EXISTS \`${table.name}\``);
        console.log(`✅ Dropped stale backup table: ${table.name}`);
      }
    }
  }
};

// Database initialization and server startup
const startServer = async () => {
  try {
    // Clean up stale SQLite backup tables before syncing the schema
    await dropStaleBackupTables();

    // Sync database without altering existing SQLite schema at runtime.
    // Schema migrations should be handled explicitly via db/setup.js.
    await sequelize.sync({ alter: false, force: false });
    console.log('✅ Database synchronized');

    // Mount authentication routes
    app.use('/api/auth', authRoutes);
    app.use('/api/mfa', mfaRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/audit-logs', auditRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/monitoring', monitoringRoutes);
    app.use('/api/tickets', ticketRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/sla', slaRoutes);
    app.use('/api/portal', clientPortalRoutes);

    // Initialize monitoring service with demo data
    console.log('🔍 Initializing monitoring service...');
    monitoringService.generateMockDeviceData();
    console.log('✅ Monitoring service initialized with demo devices');

    // AI Settings routes
    app.get('/api/ai/settings', optionalAuth, (req, res) => {
      res.json(getAiSettings());
    });

    app.post('/api/ai/settings', authenticate, (req, res) => {
      try {
        // Only super admin can change AI settings
        if (req.user.role !== 'super_admin') {
          return res.status(403).json({ error: 'Only super admin can change AI settings' });
        }
        updateAiSettings(req.body);
        res.json({ status: 'ok', settings: getAiSettings() });
      } catch (error) {
        res.status(400).json({ error: error.message || 'Unable to update AI settings' });
      }
    });

    // AI Action routes
    app.post('/api/ai/chat', optionalAuth, async (req, res) => {
      try {
        const result = await handleAiAction('chat', req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/ai/search', optionalAuth, async (req, res) => {
      try {
        const result = await handleAiAction('search', req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/ai/developer', authenticate, async (req, res) => {
      try {
        // Developer mode requires authentication
        const result = await handleAiAction('developer', req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/ai/system', authenticate, async (req, res) => {
      try {
        // System mode requires super admin
        if (req.user.role !== 'super_admin') {
          return res.status(403).json({ error: 'Super admin access required' });
        }
        const result = await handleAiAction('system', req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Legacy AI endpoint
    app.post('/ai', optionalAuth, async (req, res) => {
      try {
        const result = await handleAiAction('chat', req.body);
        res.json({ reply: result.reply, provider: result.provider });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
      });
    });

    // Start listening
    app.listen(port, () => {
      console.log(`
╔════════════════════════════════════════════════════╗
║     Halo IT Services - Phase 1 Core Platform       ║
║          🚀 Backend Server Running                 ║
╚════════════════════════════════════════════════════╝

✅ Port: ${port}
✅ Node Environment: ${process.env.NODE_ENV || 'development'}
✅ Database: SQLite (${__dirname}/db/halo.db)

📍 Key API Endpoints:
   POST   /api/auth/register       - Register new user
   POST   /api/auth/login          - Login user
   POST   /api/auth/logout         - Logout user
   POST   /api/mfa/setup           - Setup MFA
   POST   /api/mfa/verify-setup    - Verify MFA setup
   GET    /api/users               - List users (admin)
   POST   /api/users               - Create user (admin)
   GET    /api/dashboard           - Dashboard data
   GET    /api/audit-logs          - Audit logs

📚 Test Admin Account:
   Email: admin@halo.local
   Password: SecureAdmin123!

🚀 Quick Start:
   1. npm install
   2. npm run db:setup
   3. npm start

      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
