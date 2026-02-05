const express = require('express');
const router = express.Router();
const traccarLocationService = require('../services/traccarLocationService');

/**
 * Validate Traccar location request body
 */
const validateTraccarRequest = (body) => {
  const errors = [];
  
  // Check if body exists
  if (!body || typeof body !== 'object') {
    errors.push('Request body is required and must be a JSON object');
    return { valid: false, errors };
  }

  // Check device_id
  const deviceId = body.device_id || body.deviceId;
  if (!deviceId) {
    errors.push('device_id is required');
  } else if (typeof deviceId !== 'string') {
    errors.push('device_id must be a string');
  } else if (deviceId.trim().length === 0) {
    errors.push('device_id cannot be empty');
  }

  // Check location object
  if (!body.location || typeof body.location !== 'object') {
    errors.push('location object is required');
  } else {
    // Check coordinates
    if (!body.location.coords || typeof body.location.coords !== 'object') {
      errors.push('location.coords object is required');
    } else {
      const { latitude, longitude } = body.location.coords;
      
      if (latitude === undefined || longitude === undefined) {
        errors.push('latitude and longitude are required in location.coords');
      } else {
        // Validate latitude range (-90 to 90)
        if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
          errors.push('latitude must be a number between -90 and 90');
        }
        
        // Validate longitude range (-180 to 180)
        if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
          errors.push('longitude must be a number between -180 and 180');
        }
      }
      
      // Validate speed (if provided)
      if (body.location.coords.speed !== undefined) {
        if (typeof body.location.coords.speed !== 'number' || body.location.coords.speed < 0) {
          errors.push('speed must be a non-negative number');
        }
      }
      
      // Validate accuracy (if provided)
      if (body.location.coords.accuracy !== undefined) {
        if (typeof body.location.coords.accuracy !== 'number' || body.location.coords.accuracy < 0) {
          errors.push('accuracy must be a non-negative number');
        }
      }
    }
    
    // Validate timestamp
    if (body.location.timestamp) {
      const timestamp = new Date(body.location.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('timestamp must be a valid ISO date string');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedData: {
      device_id: deviceId,
      location: body.location
    }
  };
};

/**
 * @route POST /api/traccar/location
 * @desc Receive location updates from Traccar mobile app
 * @access Public (Traccar app sends here)
 */
router.post('/location', async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    // Log incoming request for debugging
    console.log('Traccar location update received:', {
      device_id: req.body.device_id,
      ip: clientIp,
      timestamp: new Date().toISOString()
    });

    // Validate request body
    const validation = validateTraccarRequest(req.body);
    
    if (!validation.valid) {
      console.log('Invalid Traccar request:', {
        ip: clientIp,
        device_id: req.body.device_id,
        errors: validation.errors,
        received: Object.keys(req.body).join(', ')
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.errors,
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`
      });
    }

    // Process the location update
    const result = await traccarLocationService.processTraccarLocation(
      validation.normalizedData,
      req.io,
      req.db
    );

    const processingTime = Date.now() - startTime;
    
    if (!result.success) {
      console.log('Traccar location processing failed:', {
        device_id: validation.normalizedData.device_id,
        error: result.error,
        processingTime: `${processingTime}ms`
      });
      
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to process location',
        device_id: result.device_id || validation.normalizedData.device_id,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
        requestId: `req_${startTime}`
      });
    }

    // Log successful processing
    console.log('Traccar location processed successfully:', {
      device_id: validation.normalizedData.device_id,
      vehicleId: result.vehicleId,
      processingTime: `${processingTime}ms`,
      hasViolation: !!result.violation,
      zoneEvents: result.zoneEvents ? result.zoneEvents.length : 0
    });

    // Return success response
    res.json({
      success: true,
      message: 'Location processed successfully',
      processed: result.processed,
      device_id: result.device_id || validation.normalizedData.device_id,
      vehicleId: result.vehicleId,
      hasViolation: !!result.violation,
      zoneEvents: result.zoneEvents ? result.zoneEvents.length : 0,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
      requestId: `req_${startTime}`
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('Traccar location endpoint error:', {
      error: error.message,
      stack: error.stack,
      ip: clientIp,
      device_id: req.body.device_id,
      processingTime: `${processingTime}ms`
    });

    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = 'Internal server error processing location';
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.name === 'DatabaseError') {
      statusCode = 503;
      errorMessage = 'Service temporarily unavailable';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      errorType: error.name,
      device_id: req.body.device_id,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
      requestId: `req_${startTime}`,
      // Include stack trace in development only
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

/**
 * @route POST /api/traccar/location/batch
 * @desc Receive batch location updates from Traccar
 * @access Public
 */
router.post('/location/batch', async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    // Validate batch request
    if (!Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        error: 'Request body must be an array of location updates',
        received: typeof req.body,
        timestamp: new Date().toISOString()
      });
    }

    console.log('Traccar batch location update received:', {
      count: req.body.length,
      ip: clientIp,
      timestamp: new Date().toISOString()
    });

    // Process each location update
    const results = [];
    const errors = [];
    
    for (let i = 0; i < req.body.length; i++) {
      const locationUpdate = req.body[i];
      
      try {
        // Validate individual update
        const validation = validateTraccarRequest(locationUpdate);
        
        if (!validation.valid) {
          errors.push({
            index: i,
            device_id: locationUpdate.device_id,
            errors: validation.errors
          });
          continue;
        }

        // Process the location update
        const result = await traccarLocationService.processTraccarLocation(
          validation.normalizedData,
          req.io,
          req.db
        );

        results.push({
          index: i,
          device_id: validation.normalizedData.device_id,
          success: result.success,
          vehicleId: result.vehicleId,
          error: result.error
        });

      } catch (error) {
        errors.push({
          index: i,
          device_id: locationUpdate.device_id,
          error: error.message
        });
      }
    }

    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Batch location processing completed',
      processed: results.length,
      errors: errors.length,
      total: req.body.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
      requestId: `batch_${startTime}`
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('Traccar batch location endpoint error:', {
      error: error.message,
      ip: clientIp,
      processingTime: `${processingTime}ms`
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process batch location updates',
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
      requestId: `batch_${startTime}`
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
    
    // Validate deviceId
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid deviceId is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get vehicle zone state
    const zones = traccarLocationService.getVehicleZoneState(deviceId);
    
    res.json({
      success: true,
      deviceId,
      active: zones.length > 0,
      currentZones: zones,
      zoneCount: zones.length,
      lastUpdate: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting vehicle status:', {
      error: error.message,
      deviceId: req.params.deviceId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get vehicle status',
      deviceId: req.params.deviceId,
      timestamp: new Date().toISOString()
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
    
    // Apply filters if provided
    let filteredStates = states;
    const { minZones, maxZones } = req.query;
    
    if (minZones) {
      filteredStates = filteredStates.filter(state => 
        state.zones.length >= parseInt(minZones)
      );
    }
    
    if (maxZones) {
      filteredStates = filteredStates.filter(state => 
        state.zones.length <= parseInt(maxZones)
      );
    }
    
    res.json({
      success: true,
      count: filteredStates.length,
      total: states.length,
      vehicles: filteredStates,
      filters: {
        minZones: minZones || 'none',
        maxZones: maxZones || 'none'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting active vehicles:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get active vehicles',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/traccar/health
 * @desc Health check endpoint for Traccar integration
 * @access Public
 */
router.get('/health', (req, res) => {
  try {
    const states = traccarLocationService.getAllVehicleStates();
    
    res.json({
      success: true,
      status: 'operational',
      service: 'Traccar Integration API',
      version: '1.0.0',
      stats: {
        activeVehicles: states.length,
        totalVehicles: states.length,
        lastUpdate: states.length > 0 
          ? new Date(Math.max(...states.map(s => new Date(s.lastUpdate).getTime())))
          : null
      },
      endpoints: {
        location: 'POST /api/traccar/location',
        batchLocation: 'POST /api/traccar/location/batch',
        vehicleStatus: 'GET /api/traccar/vehicles/:deviceId/status',
        activeVehicles: 'GET /api/traccar/vehicles/active',
        health: 'GET /api/traccar/health',
        test: 'GET /api/traccar/test'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'degraded',
      error: error.message,
      timestamp: new Date().toISOString()
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
    status: 'online',
    uptime: process.uptime(),
    endpoints: {
      location: 'POST /api/traccar/location',
      batchLocation: 'POST /api/traccar/location/batch',
      vehicleStatus: 'GET /api/traccar/vehicles/:deviceId/status',
      activeVehicles: 'GET /api/traccar/vehicles/active',
      health: 'GET /api/traccar/health',
      test: 'GET /api/traccar/test'
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
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route POST /api/traccar/simulate
 * @desc Simulate a location update (for testing only)
 * @access Public (should be restricted in production)
 */
router.post('/simulate', async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      error: 'Simulation endpoint only available in development mode',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Generate random location data
    const sampleData = {
      device_id: req.body.device_id || `test_device_${Date.now()}`,
      location: {
        coords: {
          latitude: req.body.latitude || -1.2921 + (Math.random() * 0.02 - 0.01),
          longitude: req.body.longitude || 36.8219 + (Math.random() * 0.02 - 0.01),
          speed: req.body.speed || Math.floor(Math.random() * 100),
          accuracy: req.body.accuracy || 5 + Math.random() * 15,
          altitude: req.body.altitude || 1600 + Math.random() * 100,
          heading: req.body.heading || Math.floor(Math.random() * 360)
        },
        battery: {
          level: req.body.battery_level || 0.2 + Math.random() * 0.6,
          is_charging: req.body.is_charging || Math.random() > 0.8
        },
        odometer: req.body.odometer || 12345 + Math.random() * 1000,
        is_moving: req.body.is_moving !== undefined ? req.body.is_moving : Math.random() > 0.3,
        timestamp: req.body.timestamp || new Date().toISOString()
      }
    };

    console.log('Simulating Traccar location:', {
      device_id: sampleData.device_id,
      simulated: true
    });

    // Process the simulated location
    const result = await traccarLocationService.processTraccarLocation(
      sampleData,
      req.io,
      req.db
    );

    res.json({
      success: true,
      message: 'Location simulation successful',
      simulated: true,
      device_id: sampleData.device_id,
      result: result.success ? 'Processed' : 'Failed',
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Simulation error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Simulation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler for undefined Traccar routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Traccar endpoint not found',
    requested: `${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'POST /api/traccar/location',
      'POST /api/traccar/location/batch',
      'GET /api/traccar/vehicles/:deviceId/status',
      'GET /api/traccar/vehicles/active',
      'GET /api/traccar/health',
      'GET /api/traccar/test',
      'POST /api/traccar/simulate (development only)'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;