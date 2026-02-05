const express = require('express');
const router = express.Router();
const traccarLocationService = require('../services/traccarLocationService');

/**
 * @route POST /api/traccar/location
 * @desc Receive location updates from Traccar mobile app
 * @access Public (Traccar app sends here)
 * 
 * Expected format from Traccar:
 * {
 *   "device_id": "device-123",
 *   "location": {
 *     "coords": {
 *       "latitude": -1.2921,
 *       "longitude": 36.8219,
 *       "speed": 45,
 *       "accuracy": 10,
 *       "altitude": 1600,
 *       "heading": 90
 *     },
 *     "battery": {
 *       "level": 0.75,
 *       "is_charging": false
 *     },
 *     "odometer": 12345.67,
 *     "is_moving": true,
 *     "timestamp": "2024-01-15T10:30:00Z"
 *   }
 * }
 */
router.post('/location', async (req, res) => {
  try {
    console.log('Traccar location update received:', {
      device_id: req.body.device_id,
      timestamp: req.body.location?.timestamp,
      ip: req.ip
    });

    console.log('Traccar location update received:', req.body.device_id ,req.ip);

    // Process the location update
    const result = await traccarLocationService.processTraccarLocation(
      req.body,
      req.io,   // Socket.io instance from middleware
      req.db    // Database connection status
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        device_id: result.device_id
      });
    }

    // Return success response
    res.json({
      success: true,
      message: 'Location processed successfully',
      processed: result.processed,
      device_id: result.device_id,
      vehicleId: result.vehicleId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Traccar location endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error processing location',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/traccar/vehicles/:deviceId/status
 * @desc Get current status of a vehicle
 * @access Public
 */
router.get('/vehicles/:deviceId/status', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // In a real implementation, you would fetch from database
    // For now, return basic status
    const zones = traccarLocationService.getVehicleZoneState(deviceId);
    
    res.json({
      success: true,
      deviceId,
      active: zones.length > 0,
      currentZones: zones,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get vehicle status'
    });
  }
});

/**
 * @route GET /api/traccar/vehicles/active
 * @desc Get all active vehicles
 * @access Public
 */
router.get('/vehicles/active', (req, res) => {
  try {
    const states = traccarLocationService.getAllVehicleStates();
    
    res.json({
      success: true,
      count: states.length,
      vehicles: states,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get active vehicles'
    });
  }
});

/**
 * @route GET /api/traccar/test
 * @desc Test endpoint to verify Traccar integration
 * @access Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Traccar integration API is operational',
    endpoints: {
      location: 'POST /api/traccar/location',
      vehicleStatus: 'GET /api/traccar/vehicles/:deviceId/status',
      activeVehicles: 'GET /api/traccar/vehicles/active'
    },
    sampleRequest: {
      method: 'POST',
      url: '/api/traccar/location',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        device_id: 'your-traccar-device-id',
        location: {
          coords: {
            latitude: -1.2921,
            longitude: 36.8219,
            speed: 45,
            accuracy: 10,
            altitude: 1600,
            heading: 90
          },
          battery: {
            level: 0.75,
            is_charging: false
          },
          odometer: 12345.67,
          is_moving: true,
          timestamp: new Date().toISOString()
        }
      }
    }
  });
});

module.exports = router;