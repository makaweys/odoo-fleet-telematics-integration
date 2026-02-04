const express = require('express');
const router = express.Router();
const locationService = require('../services/locationService');

/**
 * @route POST /api/location/update
 * @desc Update vehicle location
 * @access Public (should be secured in production)
 */
router.post('/update', async (req, res) => {
  try {
    const { device_id, location } = req.body;

    // Validate required fields
    if (!device_id || !location || !location.coords) {
      return res.status(400).json({
        success: false,
        error: 'device_id and location.coords are required'
      });
    }

    const { latitude, longitude } = location.coords;
    
    if (latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    // Process location update
    const result = await locationService.processLocationUpdate(
      req.body,
      req.io,     // Socket.io instance
      req.db      // Database connection status
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Location processed successfully',
      data: {
        vehicleId: result.vehicle._id || result.vehicle.deviceId,
        location: {
          latitude,
          longitude,
          timestamp: location.timestamp || new Date()
        },
        event: result.violation ? 'violation' : 'location_updated',
        violation: result.violation,
        zones: {
          current: result.currentZones,
          entered: result.enteredZones,
          exited: result.exitedZones
        }
      }
    });

  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * @route GET /api/location/vehicle/:deviceId
 * @desc Get vehicle's current location
 * @access Public
 */
router.get('/vehicle/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const location = locationService.getVehicleLocation(deviceId);
    
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle location not found'
      });
    }

    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get location'
    });
  }
});

/**
 * @route GET /api/location/active
 * @desc Get all active vehicles with locations
 * @access Public
 */
router.get('/active', (req, res) => {
  try {
    const vehicles = locationService.getAllActiveVehicles();
    
    res.json({
      success: true,
      count: vehicles.length,
      data: vehicles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get active vehicles'
    });
  }
});

/**
 * @route GET /api/location/test
 * @desc Test endpoint for location updates
 * @access Public (for testing)
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Location API is working',
    endpoints: {
      update: 'POST /api/location/update',
      getVehicle: 'GET /api/location/vehicle/:deviceId',
      getActive: 'GET /api/location/active'
    },
    exampleUpdate: {
      device_id: 'test_device_001',
      location: {
        coords: {
          latitude: -1.2921,
          longitude: 36.8219,
          speed: 45,
          accuracy: 10,
          altitude: 1600
        },
        battery: {
          level: 0.75,
          is_charging: false
        },
        is_moving: true,
        timestamp: new Date().toISOString()
      }
    }
  });
});

module.exports = router;