// routes/simulatorRoutes.js - Routes to control the vehicle simulator
const express = require('express');
const router = express.Router();
const { getSimulator } = require('../jobs/vehicleSimulator-with-ioevents');

// Middleware to ensure simulator is available
const requireSimulator = (req, res, next) => {
  const simulator = getSimulator();
  if (!simulator) {
    return res.status(400).json({ 
      error: 'Simulator not running',
      message: 'Start the simulator in development mode first'
    });
  }
  next();
};

// Get simulator status
router.get('/status', requireSimulator, (req, res) => {
  const simulator = getSimulator();
  const vehicles = simulator.getSimulatedVehicles();
  
  res.json({
    running: true,
    vehicleCount: vehicles.length,
    onlineVehicles: vehicles.filter(v => v.isOnline).length,
    lastUpdate: new Date(),
    updateInterval: simulator.updateInterval
  });
});

// Get all simulated vehicles
router.get('/vehicles', requireSimulator, (req, res) => {
  const simulator = getSimulator();
  const vehicles = simulator.getSimulatedVehicles();
  
  res.json({
    vehicles: vehicles.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type,
      status: v.status,
      isOnline: v.isOnline,
      driver: v.driver,
      company: v.company,
      currentLocation: v.currentLocation,
      icon: v.icon,
      color: v.color
    })),
    count: vehicles.length
  });
});

// Get recent violations
router.get('/violations', requireSimulator, (req, res) => {
  const simulator = getSimulator();
  const limit = parseInt(req.query.limit) || 50;
  const violations = simulator.getViolationLog(limit);
  
  res.json({
    violations,
    count: violations.length
  });
});

// Control a specific vehicle
router.post('/vehicles/:vehicleId/control', requireSimulator, (req, res) => {
  const simulator = getSimulator();
  const { vehicleId } = req.params;
  const { action, ...params } = req.body;
  
  const result = simulator.controlVehicle(vehicleId, { action, ...params });
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

// Get vehicle location history
router.get('/vehicles/:vehicleId/history', requireSimulator, (req, res) => {
  const simulator = getSimulator();
  const { vehicleId } = req.params;
  const limit = parseInt(req.query.limit) || 20;
  
  const history = simulator.getVehicleHistory(vehicleId, limit);
  
  res.json({
    vehicleId,
    history,
    count: history.length
  });
});

// Add a new simulated vehicle
router.post('/vehicles', requireSimulator, (req, res) => {
  const simulator = getSimulator();
  const { name, type, driver, company, startLat, startLng } = req.body;
  
  const newVehicle = {
    id: `vehicle_${Date.now()}`,
    name: name || `New Vehicle ${simulator.simulatedVehicles.length + 1}`,
    deviceId: `dev_${Date.now()}`,
    deviceToken: `sim_token_${Date.now()}`,
    type: type || 'car',
    status: 'idle',
    driver: driver || 'Unknown Driver',
    company: company || 'Test Company',
    color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
    icon: '🚗',
    currentLocation: {
      lat: startLat || -1.2921,
      lng: startLng || 36.8219,
      speed: 0,
      heading: 0,
      accuracy: 10,
      timestamp: new Date()
    },
    route: [
      { lat: startLat || -1.2921, lng: startLng || 36.8219 },
      { lat: (startLat || -1.2921) + 0.01, lng: (startLng || 36.8219) + 0.01 }
    ],
    routeIndex: 0,
    speedRange: { min: 20, max: 80 },
    violationChance: 0.1,
    lastViolation: null,
    isOnline: true
  };
  
  simulator.simulatedVehicles.push(newVehicle);
  
  res.json({
    success: true,
    vehicle: newVehicle,
    message: 'Vehicle added to simulation'
  });
});

// Toggle simulation on/off
router.post('/toggle', requireSimulator, (req, res) => {
  const simulator = getSimulator();
  const { action } = req.body;
  
  if (action === 'stop') {
    simulator.stop();
    res.json({ success: true, running: false, message: 'Simulation stopped' });
  } else if (action === 'start') {
    simulator.start();
    res.json({ success: true, running: true, message: 'Simulation started' });
  } else {
    res.status(400).json({ error: 'Invalid action. Use "start" or "stop"' });
  }
});

module.exports = router;