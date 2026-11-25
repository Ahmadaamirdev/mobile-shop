const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { connectDB, closeDB, ensureDBConnected, poolOptions } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { cacheMiddleware, autoInvalidateMiddleware } = require('./middleware/cache');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health & Connection Monitoring API (open even during reconnect to inspect status)
app.get('/api/health', (req, res) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = mongoose.connection.readyState;

  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? 'healthy' : 'degraded',
    app: 'Unity Mobile Management API',
    database: {
      status: states[dbState] || 'unknown',
      readyState: dbState,
      poolConfig: {
        maxPoolSize: poolOptions.maxPoolSize,
        minPoolSize: poolOptions.minPoolSize,
      },
    },
    timestamp: new Date(),
  });
});

// Root API ping
app.get(['/api', '/'], (req, res, next) => {
  if (req.path === '/' && !req.headers['x-vercel-id']) {
    return next();
  }
  res.json({
    status: 'online',
    app: 'Unity Mobile API',
    uptime: process.uptime(),
  });
});

// Middleware: Ensure database pool is active before running CRUD operations
app.use('/api', ensureDBConnected);
app.use(ensureDBConnected);

// Middleware: Fast in-memory caching for GETs & instant invalidation on mutations
app.use('/api', autoInvalidateMiddleware);
app.use('/api', cacheMiddleware);

// API Routes (mounted with both /api and without for complete serverless rewrite support)
app.use(['/api/purchases', '/purchases'], require('./routes/purchaseRoutes'));
app.use(['/api/inventory', '/inventory'], require('./routes/inventoryRoutes'));
app.use(['/api/sales', '/sales'], require('./routes/saleRoutes'));
app.use(['/api/invoices', '/invoices'], require('./routes/invoiceRoutes'));

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server = null;

// Graceful Shutdown: Handle process termination signals cleanly
const handleShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await closeDB();
        console.log('Graceful shutdown completed successfully.');
        process.exit(0);
      } catch (err) {
        console.error('Error during database pool closure:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // Force close after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Connect to MongoDB Atlas first, then bind HTTP port (for local development)
const start = async () => {
  try {
    await connectDB();
  } catch (err) {
    console.warn('⚠️  Initial MongoDB connection pending, auto-reconnect will establish pool...');
  }

  server = app.listen(PORT, () => {
    console.log(`🚀 Unity Mobile Server running on port ${PORT}`);
  });
};

// Start server when run directly (local dev or Vercel service runner)
if (require.main === module) {
  start();
} else {
  // When imported as a module in serverless mode, pre-warm DB connection
  if (process.env.VERCEL) {
    connectDB().catch((err) => {
      console.warn('⚠️ Serverless background DB connection:', err.message);
    });
  }
}

module.exports = app;
