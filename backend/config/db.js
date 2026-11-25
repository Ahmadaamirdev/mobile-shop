const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers to prevent SRV lookup failures on Windows / local ISPs
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore if not supported in environment
}

// Production-grade Atlas Connection pool & lifecycle configuration options
const poolOptions = {
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 20,
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 2,
  serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_TIMEOUT_MS, 10) || 30000,
  connectTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  w: 'majority',
};

let isConnected = false;
let isShuttingDown = false;
let retryTimer = null;

// Helper to remove any obsolete legacy indexes from MongoDB Atlas
const cleanLegacyIndexes = async () => {
  try {
    const col = mongoose.connection.db.collection('inventories');
    const indexes = await col.indexes();
    const hasLegacyUnique = indexes.some((idx) => idx.name === 'modelName_1_modelNumber_1');
    if (hasLegacyUnique) {
      console.log('🔄 Cleaning legacy unique index modelName_1_modelNumber_1 from inventories...');
      await col.dropIndex('modelName_1_modelNumber_1');
      console.log('✅ Legacy index successfully removed.');
    }
  } catch (err) {
    // Non-fatal if index is already absent
  }
};

// Setup event listeners for connection monitoring
mongoose.connection.on('connected', () => {
  isConnected = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  console.log(`✅ MongoDB Connection Pool active (Max: ${poolOptions.maxPoolSize}, Min: ${poolOptions.minPoolSize})`);
  cleanLegacyIndexes();
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB Connection Error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️  MongoDB disconnected from cluster.');
  if (!isShuttingDown && !retryTimer && mongoose.connection.readyState === 0) {
    console.log('🔄 Attempting automatic reconnection to MongoDB in 5 seconds...');
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connectDB();
    }, 5000);
  }
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('🔄 MongoDB reconnected to cluster.');
});

const connectDB = async () => {
  if (isShuttingDown) return;

  // Prevent duplicate connections if already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const connUri = process.env.MONGODB_URI;
    if (!connUri || connUri.includes('username:password')) {
      console.warn('⚠️  MONGODB_URI is not configured yet with valid credentials in .env.');
      console.warn('    Please paste your MongoDB Atlas connection string into backend/.env.');
      return;
    }

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    const conn = await mongoose.connect(connUri, poolOptions);
    console.log(`✅ MongoDB Connected to host: ${conn.connection.host}`);
    await cleanLegacyIndexes();
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Auto-retry connection every 5 seconds if initial connect fails
    if (!isShuttingDown && !retryTimer) {
      console.log('🔄 Reconnecting to MongoDB in 5 seconds...');
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connectDB();
      }, 5000);
    }
    throw error;
  }
};

// Express Middleware: Ensures database is ready before processing API request
const ensureDBConnected = async (req, res, next) => {
  // If health check endpoint, let it pass through immediately
  if (req.path === '/health') {
    return next();
  }

  if (mongoose.connection.readyState === 1) {
    return next();
  }

  // If disconnected (0) and not currently connecting, trigger reconnect
  if (mongoose.connection.readyState === 0) {
    connectDB().catch(() => {});
  }

  // Wait up to 5 seconds for connection to become ready
  const start = Date.now();
  while (Date.now() - start < 5000) {
    if (mongoose.connection.readyState === 1) {
      return next();
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  // If still not connected after 5 seconds, return 503 so frontend retries seamlessly
  return res.status(503).json({
    success: false,
    message: 'Database is currently establishing connection. Retrying request...',
    retryAfterMs: 800,
  });
};

// Graceful shutdown helper: closes all pooled sockets properly
const closeDB = async () => {
  isShuttingDown = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (mongoose.connection.readyState !== 0) {
    console.log('Closing MongoDB connection pool...');
    await mongoose.connection.close(false);
    console.log('MongoDB connection pool cleanly closed.');
  }
};

module.exports = {
  connectDB,
  closeDB,
  ensureDBConnected,
  poolOptions,
};
