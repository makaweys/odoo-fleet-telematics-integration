const express = require('express');
const router = express.Router();
const odooService = require('../services/odooService');

/**
 * @route POST /api/odoo/vehicles/sync
 * @desc Sync vehicle details from Odoo
 * @access Public (called by Odoo automation)
 * 
 * Expected payload from Odoo:
 * {
 *   "odooVehicleId": 123,
 *   "name": "Vehicle Name",
 *   "licensePlate": "ABC-123",
 *   "type": "Truck Model",
 *   "driverName": "Driver Name",
 *   "driverId": 456,
 *   "deviceId": "device-001",
 *   "traccarId": "traccar-001"
 * }
 */
router.post('/vehicles/sync', async (req, res) => {
  try {
    console.log('Odoo vehicle sync request received:', {
      odooVehicleId: req.body.odooVehicleId,
      timestamp: new Date().toISOString()
    });

    // Process the sync request
    const result = await odooService.syncVehicleFromOdoo(
      req.body,
      req.db,  // Database connection status
      req.io   // Socket.io instance
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Vehicle synced successfully',
      data: result.vehicle,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Odoo vehicle sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error syncing vehicle',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/odoo/trips/assign
 * @desc Assign trip to vehicle from Odoo
 * @access Public (called by Odoo automation)
 * 
 * Expected payload from Odoo:
 * {
 *   "odooVehicleId": 123,
 *   "odooCustomerIds": [456, 789],
 *   "zoneId": "zone_id_string",
 *   "x_studio_trip_id": 999,
 *   "invoices_count": 5,
 *   "total_value": 1500.00,
 *   "invoices": [...]
 * }
 */
router.post('/trips/assign', async (req, res) => {
  try {
    console.log('Odoo trip assignment request received:', {
      tripId: req.body.x_studio_trip_id,
      vehicleId: req.body.odooVehicleId,
      timestamp: new Date().toISOString()
    });

    // Process trip assignment
    const result = await odooService.assignTripFromOdoo(
      req.body,
      req.db,  // Database connection status
      req.io   // Socket.io instance
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Trip assigned successfully',
      data: result.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Odoo trip assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error assigning trip',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/odoo/trips/complete
 * @desc Complete a trip
 * @access Public (called by Odoo automation)
 * 
 * Expected payload:
 * {
 *   "tripId": 999,
 *   "vehicleId": "vehicle_mongo_id"
 * }
 */
router.post('/trips/complete', async (req, res) => {
  try {
    const { tripId, vehicleId } = req.body;

    if (!tripId || !vehicleId) {
      return res.status(400).json({
        success: false,
        error: 'tripId and vehicleId are required'
      });
    }

    const result = await odooService.completeTrip(
      tripId,
      vehicleId,
      req.db,
      req.io
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Trip completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error completing trip:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error completing trip'
    });
  }
});

/**
 * @route GET /api/odoo/trips/active
 * @desc Get all active trips
 * @access Public
 */
router.get('/trips/active', async (req, res) => {
  try {
    const result = await odooService.getAllActiveTrips(req.db);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      count: result.count,
      trips: result.trips,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting active trips:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error getting active trips'
    });
  }
});

/**
 * @route GET /api/odoo/trips/vehicle/:vehicleId/active
 * @desc Get active trip for a specific vehicle
 * @access Public
 */
router.get('/trips/vehicle/:vehicleId/active', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const result = await odooService.getActiveTrip(vehicleId, req.db);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      trip: result.trip,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting active trip for vehicle:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error getting active trip'
    });
  }
});

/**
 * @route GET /api/odoo/test
 * @desc Test endpoint for Odoo integration
 * @access Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Odoo integration API is operational',
    endpoints: {
      vehicleSync: {
        method: 'POST',
        url: '/api/odoo/vehicles/sync',
        description: 'Sync vehicle details from Odoo'
      },
      tripAssign: {
        method: 'POST',
        url: '/api/odoo/trips/assign',
        description: 'Assign trip to vehicle from Odoo'
      },
      tripComplete: {
        method: 'POST',
        url: '/api/odoo/trips/complete',
        description: 'Complete a trip'
      },
      activeTrips: {
        method: 'GET',
        url: '/api/odoo/trips/active',
        description: 'Get all active trips'
      }
    },
    sampleRequests: {
      vehicleSync: {
        odooVehicleId: 123,
        name: "Delivery Truck 1",
        licensePlate: "KAA-123A",
        type: "Isuzu NQR",
        driverName: "John Doe",
        driverId: 456,
        deviceId: "device_001",
        traccarId: "traccar_001"
      },
      tripAssign: {
        odooVehicleId: 123,
        odooCustomerIds: [789, 790],
        zoneId: "67890abcdef",
        x_studio_trip_id: 999,
        invoices_count: 2,
        total_value: 1500.50,
        invoices: [
          {
            partner_id: 789,
            partner_name: "Customer A",
            amount_total: 750.25
          },
          {
            partner_id: 790,
            partner_name: "Customer B",
            amount_total: 750.25
          }
        ]
      }
    }
  });
});

module.exports = router;