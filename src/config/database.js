const mongoose = require('mongoose');

// Dummy data fallback
const useDummyData = process.env.USE_DUMMY_DATA === 'true' || false;
let mongoConnected = false;

const connectDB = async () => {
  // If dummy data is explicitly enabled or no MongoDB URI, use dummy data
  if (useDummyData || !process.env.MONGODB_URI) {
    console.log('Using dummy data mode - MongoDB not connected');
    return { connected: false, mongoose: null };
  }

  try {
    // Remove deprecated options: useNewUrlParser and useUnifiedTopology
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      family: 4, // Use IPv4, skip IPv6
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 1, // Minimum number of connections in the pool
    });
    
    console.log('MongoDB connected successfully');
    mongoConnected = true;
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
      mongoConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      mongoConnected = false;
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
      mongoConnected = true;
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
    return { connected: true, mongoose };
  } catch (error) {
    console.error('MongoDB connection failed, using dummy data:', error.message);
    console.log('Server will continue with dummy data mode');
    mongoConnected = false;
    return { connected: false, mongoose: null };
  }
};

// Helper to check if we should use DB or dummy data
const shouldUseDB = () => {
  return mongoConnected && !useDummyData;
};

// Helper to check connection status
const getConnectionStatus = () => {
  return {
    connected: mongoConnected,
    dummyMode: useDummyData,
    mongoUri: process.env.MONGODB_URI ? 'Configured' : 'Not configured',
    connectionState: mongoose.connection ? mongoose.connection.readyState : -1,
    states: {
      '-1': 'Not initialized',
      '0': 'Disconnected',
      '1': 'Connected',
      '2': 'Connecting',
      '3': 'Disconnecting'
    }
  };
};

// Test connection (optional)
const testConnection = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      // Run a simple ping command to test the connection
      await mongoose.connection.db.admin().ping();
      console.log('MongoDB ping successful');
      return true;
    }
    return false;
  } catch (error) {
    console.error('MongoDB ping failed:', error.message);
    return false;
  }
};

module.exports = { 
  connectDB, 
  shouldUseDB, 
  getConnectionStatus,
  testConnection,
  mongoose 
};