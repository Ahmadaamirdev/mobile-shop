const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { connectDB, closeDB, poolOptions } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to MongoDB with connection pooling
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health & Connection Monitoring API
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
        maxIdleTimeMS: poolOptions.maxIdleTimeMS,
      },
    },
    timestamp: new Date(),
  });
});

// API Routes
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Unity Mobile Server running on port ${PORT}`);
});

// Graceful Shutdown: Handle process termination signals cleanly
const handleShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Stop accepting new HTTP requests
  server.close(async () => {
    console.log('HTTP server closed.');

    // Release all MongoDB connections from pool
    try {
      await closeDB();
      console.log('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database pool closure:', err);
      process.exit(1);
    }
  });

  // Force close after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = app;
