const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers to prevent SRV lookup failures on Windows / local ISPs
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if not supported in environment
}

// Connection pool & lifecycle configuration options
const poolOptions = {
  // Maximum number of connections in the pool
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 10,
  // Minimum number of warm connections kept open
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 2,
  // Close unused connections after 30 seconds of inactivity
  maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME_MS, 10) || 30000,
  // Timeouts to prevent hung requests
  serverSelectionTimeoutMS: 5000, // Timeout after 5s if server unreachable
  socketTimeoutMS: 45000,          // Close socket after 45s of inactivity
  connectTimeoutMS: 10000,         // Timeout after 10s on initial connection
};

let isConnected = false;

// Setup event listeners for connection monitoring
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log(`✅ MongoDB Connection Pool active (Max: ${poolOptions.maxPoolSize}, Min: ${poolOptions.minPoolSize}, IdleTimeout: ${poolOptions.maxIdleTimeMS}ms)`);
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB Connection Error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️  MongoDB disconnected from cluster.');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('🔄 MongoDB reconnected to cluster.');
});

const connectDB = async () => {
  // Prevent duplicate connections if already connected or connecting
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  try {
    const connUri = process.env.MONGODB_URI;
    if (!connUri || connUri.includes('username:password')) {
      console.warn('⚠️  MONGODB_URI is not configured yet with valid credentials in .env.');
      console.warn('    Please paste your MongoDB Atlas connection string into backend/.env.');
      return;
    }

    const conn = await mongoose.connect(connUri, poolOptions);
    console.log(`✅ MongoDB Connected to host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
  }
};

// Graceful shutdown helper: closes all pooled sockets properly
const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    console.log('Closing MongoDB connection pool...');
    await mongoose.connection.close(false);
    console.log('MongoDB connection pool cleanly closed.');
  }
};

module.exports = {
  connectDB,
  closeDB,
  poolOptions,
};
