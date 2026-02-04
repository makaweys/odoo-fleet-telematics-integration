require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { connectDB } = require('./config/database');

// Initialize app
const app = express();
const server = http.createServer(app);

// Socket.io setup
const { initSocket } = require('./lib/socket');
const io = initSocket(server);

// Database connection
const db = connectDB();


// Add this after database connection and before routes:
// Load zones
const { loadZones, startAutoRefresh } = require('./utils/zoneManager');
loadZones(db); // Initial load
startAutoRefresh(db); // Start auto-refresh

// Make zones available to requests if needed
// app.use((req, res, next) => {
//   req.zones = require('./utils/zoneManager').getZones();
//   next();
// });


// Middleware
app.use(cors());
app.use(express.json());

// Inject database status and socket into requests
app.use((req, res, next) => {
  req.db = db;
  req.io = io;
  next();
});

// Routes
// Traccar routes (for mobile app integration)
app.use('/api/traccar', require('./routes/traccarRoutes'));

// Odoo integration routes
app.use('/api/odoo', require('./routes/odooRoutes'));

//Other routes for front end react app
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/violations', require('./routes/violationRoutes'));
app.use('/api/location', require('./routes/locationRoutes'));

// Geofence management routes (for React frontend)
app.use('/api/geofences', require('./routes/geofenceRoutes'));

// POI management routes (for React frontend)
app.use('/api/pois', require('./routes/poiRoutes'));

// Zone management routes (for React frontend)
app.use('/api/zones', require('./routes/zoneRoutes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    db: req.db.connected ? 'connected' : 'dummy',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database mode: ${db.connected ? 'MongoDB' : 'Dummy Data'}`);
});

// Start simulator in development
if (process.env.NODE_ENV === 'development') {
  const { startSimulator } = require('./jobs/vehicleSimulator');
  startSimulator(io);
}