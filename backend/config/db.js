const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers to prevent SRV lookup failures on Windows / local ISPs
try {
  if (!process.env.VERCEL) {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  }
} catch (e) {
  // Ignore if not supported in environment
}

// Production-grade Atlas Connection pool & lifecycle configuration options
const poolOptions = {
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 10,
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 1,
  serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_TIMEOUT_MS, 10) || 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  maxIdleTimeMS: 45000,
  heartbeatFrequencyMS: 10000,
  family: 4, // Force IPv4 to avoid slow IPv6-first DNS/TCP fallback on Windows
  retryWrites: true,
  w: 'majority',
};

let isConnected = false;
let isShuttingDown = false;
let retryTimer = null;
let connectingPromise = null;

// Helper to remove any obsolete legacy indexes from MongoDB Atlas
const cleanLegacyIndexes = async () => {
  try {
    const col = mongoose.connection.db.collection('inventories');
    const indexes = await col.indexes();
    for (const legacyName of ['modelName_1_modelNumber_1', 'modelName_1_modelNumber_1_condition_1']) {
      if (indexes.some((idx) => idx.name === legacyName)) {
        await col.dropIndex(legacyName);
      }
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
    console.log('🔄 Attempting automatic reconnection to MongoDB in 3 seconds...');
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connectDB().catch(() => {});
    }, 3000);
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

  // If a connection attempt is currently in flight, reuse the same promise to prevent socket collisions
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      const connUri = process.env.MONGODB_URI;
      if (!connUri || connUri.includes('username:password')) {
        console.warn('⚠️  MONGODB_URI is not configured yet with valid credentials in .env.');
        console.warn('    Please paste your MongoDB Atlas connection string into backend/.env.');
        return null;
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
      // Auto-retry connection every 3 seconds if initial connect fails
      if (!isShuttingDown && !retryTimer) {
        console.log('🔄 Reconnecting to MongoDB in 3 seconds...');
        retryTimer = setTimeout(() => {
          retryTimer = null;
          connectDB().catch(() => {});
        }, 3000);
      }
      throw error;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
};

// Express Middleware: Ensures database is ready before processing API requests
const ensureDBConnected = async (req, res, next) => {
  // If health check endpoint or root ping, let it pass through immediately
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/' || req.path === '/api') {
    return next();
  }

  // Fast path: already connected
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  try {
    // If disconnected (0) or connecting (2), await the shared connecting promise
    await connectDB();
    if (mongoose.connection.readyState === 1) {
      return next();
    }
  } catch (err) {
    console.warn(`⏳ Waiting for database connection: ${err.message}`);
  }

  // Quick poll check in case connection was just established
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  // Only return 503 if connection could not be established
  return res.status(503).json({
    success: false,
    message: 'Database is currently connecting to Atlas cluster. Retrying request...',
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
