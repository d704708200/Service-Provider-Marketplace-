const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const isTestEnv = process.env.NODE_ENV === 'test';
  const uri = isTestEnv
    ? (process.env.TEST_MONGODB_URI || process.env.MONGODB_URI)
    : process.env.MONGODB_URI;

  if (!uri) {
    console.warn('MONGODB_URI is not defined in environment variables. Database connection skipped.');
    return false;
  }

  if (isConnected) {
    return true;
  }

  try {
    const connectOptions = {
      autoIndex: process.env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 5000,
    };

    // Isolate test/staging runs from production database when TEST_MONGODB_URI is not explicitly set
    if (isTestEnv && !process.env.TEST_MONGODB_URI) {
      connectOptions.dbName = process.env.TEST_DB_NAME || 'service_marketplace_staging';
    }

    const conn = await mongoose.connect(uri, connectOptions);

    isConnected = conn.connections[0].readyState === 1;
    console.log(`MongoDB Connected: ${conn.connection.host} (db: ${conn.connection.name})`);
    return true;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    return false;
  }
};

const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };

  const stateCode = mongoose.connection.readyState;
  return {
    state: states[stateCode] || 'unknown',
    statusCode: stateCode,
    isConnected: stateCode === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
    console.log('MongoDB connection closed.');
  }
};

module.exports = {
  connectDB,
  getDBStatus,
  disconnectDB
};
