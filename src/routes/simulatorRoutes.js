// routes/simulatorRoutes.js - Control the Traccar simulator (API-only version)
const express = require('express');
const router = express.Router();
const { getSimulator } = require('../jobs/vehicleSimulator');

// Get simulator status
router.get('/status', (req, res) => {
  const simulator = getSimulator();
  
  if (!simulator) {
    return res.json({
      running: false,
      message: 'Simulator not initialized'
    });
  }
  
  res.json(simulator.getStatus());
});

// Get all simulated vehicles
router.get('/vehicles', (req, res) => {
  const simulator = getSimulator();
  
  if (!simulator) {
    return res.status(400).json({
      error: 'Simulator not running',
      message: 'Start the simulator in development mode first'
    });
  }
  
  res.json({
    vehicles: simulator.getVehicles(),
    count: simulator.getVehicles().length
  });
});

// Control simulator
router.post('/control', (req, res) => {
  const simulator = getSimulator();
  const { action } = req.body;
  
  if (!simulator) {
    return res.status(400).json({
      error: 'Simulator not initialized',
      message: 'Simulator must be initialized first'
    });
  }
  
  switch (action) {
    case 'start':
      simulator.start();
      res.json({ 
        success: true, 
        message: 'Simulator started', 
        status: simulator.getStatus() 
      });
      break;
    
    case 'stop':
      simulator.stop();
      res.json({ 
        success: true, 
        message: 'Simulator stopped', 
        status: simulator.getStatus() 
      });
      break;
    
    case 'restart':
      simulator.stop();
      setTimeout(() => simulator.start(), 1000);
      res.json({ 
        success: true, 
        message: 'Simulator restarted', 
        status: simulator.getStatus() 
      });
      break;
    
    default:
      res.status(400).json({
        error: 'Invalid action',
        message: 'Valid actions: start, stop, restart'
      });
  }
});

// Control specific vehicle
router.post('/vehicles/:vehicleId/control', (req, res) => {
  const simulator = getSimulator();
  const { vehicleId } = req.params;
  const command = req.body;
  
  if (!simulator) {
    return res.status(400).json({
      error: 'Simulator not running',
      message: 'Start the simulator first'
    });
  }
  
  const result = simulator.controlVehicle(vehicleId, command);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

// Add new simulated vehicle
router.post('/vehicles', (req, res) => {
  const simulator = getSimulator();
  const vehicleData = req.body;
  
  if (!simulator) {
    return res.status(400).json({
      error: 'Simulator not running',
      message: 'Start the simulator first'
    });
  }
  
  const result = simulator.addVehicle(vehicleData);
  res.json(result);
});

// Trigger manual location update
router.post('/update-locations', (req, res) => {
  const simulator = getSimulator();
  
  if (!simulator) {
    return res.status(400).json({
      error: 'Simulator not running',
      message: 'Start the simulator first'
    });
  }
  
  simulator.sendAllLocationUpdates()
    .then(() => {
      res.json({
        success: true,
        message: 'Manual location updates sent',
        timestamp: new Date(),
        status: simulator.getStatus()
      });
    })
    .catch(error => {
      res.status(500).json({
        success: false,
        error: error.message
      });
    });
});

// Update simulation settings
router.put('/settings', (req, res) => {
  const simulator = getSimulator();
  const { updateInterval } = req.body;
  
  if (!simulator) {
    return res.status(400).json({
      error: 'Simulator not running',
      message: 'Start the simulator first'
    });
  }
  
  if (updateInterval && updateInterval >= 1000) {
    simulator.updateInterval = updateInterval;
    
    // Restart simulation with new interval
    if (simulator.isRunning) {
      simulator.stop();
      setTimeout(() => simulator.start(), 1000);
    }
    
    res.json({
      success: true,
      message: 'Settings updated',
      updateInterval: simulator.updateInterval
    });
  } else {
    res.status(400).json({
      error: 'Invalid updateInterval',
      message: 'updateInterval must be at least 1000ms (1 second)'
    });
  }
});

module.exports = router;