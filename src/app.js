// app.js - Updated with better error handling
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { connectDB } = require('./config/database');

// Initialize app
const app = express();
const server = http.createServer(app);

// Socket.io setup
const { initSocket, getIO } = require('./lib/socket');
const io = initSocket(server);

// Database connection
const db = connectDB();

// Load zones with error handling
try {
  const { loadZones, startAutoRefresh } = require('./utils/zoneManager');
  loadZones(db); // Initial load
  startAutoRefresh(db); // Start auto-refresh
  console.log('Zones manager initialized');
} catch (error) {
  console.error('Error initializing zones manager:', error.message);
  console.log('Continuing without zones manager...');
}

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL.split(',') 
    : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make database, socket, and zones available to requests
app.use((req, res, next) => {
  req.db = db;
  req.io = io;
  req.getIO = getIO;
  next();
});

// Routes
// Traccar routes (for mobile app integration)
app.use('/api/traccar', require('./routes/traccarRoutes'));

// Odoo integration routes
app.use('/api/odoo', require('./routes/odooRoutes'));

// Other routes for front end react app
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
// app.use('/api/violations', require('./routes/violationRoutes'));
app.use('/api/location', require('./routes/locationRoutes'));

// Geofence management routes (for React frontend)
app.use('/api/geofences', require('./routes/geofenceRoutes'));

// POI management routes (for React frontend)
app.use('/api/pois', require('./routes/poiRoutes'));

// Zone management routes (for React frontend)
app.use('/api/zones', require('./routes/zoneRoutes'));

// Socket statistics endpoint
app.get('/api/socket/stats', (req, res) => {
  try {
    const { getConnectionStats } = require('./lib/socket');
    res.json(getConnectionStats());
  } catch (error) {
    res.status(500).json({ error: 'Socket not initialized' });
  }
});

// In your app.js, add simulator routes (development only)
if (process.env.NODE_ENV === 'development') {
  app.use('/api/simulator', require('./routes/simulatorRoutes'));
  console.log('Simulator routes enabled (development mode)');
}

// Zone statistics endpoint
app.get('/api/zones/stats', (req, res) => {
  try {
    const { getZones } = require('./utils/zoneManager');
    const zones = getZones();
    res.json({
      zonesCount: zones.zones.length,
      geofencesCount: zones.geofences.length,
      poisCount: zones.pois.length,
      lastUpdated: zones.lastUpdated,
      status: 'ok'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Zones manager not available',
      message: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  try {
    const { getZones } = require('./utils/zoneManager');
    const zones = getZones();
    
    res.json({ 
      status: 'ok', 
      db: req.db.connected ? 'connected' : 'dummy',
      socket: req.io ? 'active' : 'inactive',
      zones: {
        loaded: zones ? true : false,
        count: zones?.zones?.length || 0,
        geofences: zones?.geofences?.length || 0,
        pois: zones?.pois?.length || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      status: 'partial',
      db: req.db.connected ? 'connected' : 'dummy',
      socket: req.io ? 'active' : 'inactive',
      zones: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  
  res.status(err.status || 500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database mode: ${db.connected ? 'MongoDB' : 'Dummy Data'}`);
  console.log(`Socket.io path: /api/socket.io`);
  console.log(`CORS origin: ${process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:3000'}`);
});

// Start simulator in development
if (process.env.NODE_ENV === 'development') {
  try {
    const { startSimulator } = require('./jobs/vehicleSimulator-with-ioevents');
    startSimulator(io);
    console.log('Vehicle simulator started in development mode');
  } catch (error) {
    console.error('Error starting vehicle simulator:', error.message);
  }
}