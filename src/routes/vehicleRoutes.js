const express = require('express');
const router = express.Router();
const {
  getAllVehicles,
  getVehicleById,
  getVehicleByOdooId,
  getDashboardStats,
  getOnlineVehicles,
  getLowBatteryVehicles,
  assignZonesToVehicle,
  getAssignedZones,
  syncOdooVehicle
} = require('../controllers/vehicleController');

// GET /api/vehicles - Get all vehicles with latest locations
router.get('/', getAllVehicles);

// GET /api/vehicles/:id - Get specific vehicle by ID
router.get('/:id', getVehicleById);

// GET /api/vehicles/odoo/:odooId - Get vehicle by Odoo ID
router.get('/odoo/:odooId', getVehicleByOdooId);

// GET /api/vehicles/dashboard-stats - Get dashboard statistics
router.get('/dashboard-stats', getDashboardStats);

// GET /api/vehicles/online - Get online vehicles
router.get('/online', getOnlineVehicles);

// GET /api/vehicles/low-battery - Get low battery vehicles
router.get('/low-battery', getLowBatteryVehicles);

// POST /api/vehicles/:vehicleId/assign-zones - Assign zones to vehicle
router.post('/:vehicleId/assign-zones', assignZonesToVehicle);

// GET /api/vehicles/:vehicleId/zones - Get assigned zones for vehicle
router.get('/:vehicleId/zones', getAssignedZones);

// POST /api/vehicles/sync - Odoo sync endpoint (legacy, keep for compatibility)
router.post('/sync', syncOdooVehicle);

module.exports = router;