const mongoose = require('mongoose');

// Dummy data fallback
const useDummyData = process.env.USE_DUMMY_DATA === 'true' || false;
const mongoConnected = false;

const connectDB = async () => {
  if (!process.env.MONGODB_URI || useDummyData) {
    console.log('Using dummy data mode - MongoDB not connected');
    return { connected: false, mongoose: null };
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
    mongoConnected = true;
    return { connected: true, mongoose };
  } catch (error) {
    console.error('MongoDB connection failed, using dummy data:', error.message);
    return { connected: false, mongoose: null };
  }
};

// Helper to check if we should use DB or dummy data
const shouldUseDB = () => {
  return mongoConnected && !useDummyData;
};

module.exports = { connectDB, shouldUseDB, mongoose };