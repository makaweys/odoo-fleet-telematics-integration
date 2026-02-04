const express = require('express');
const router = express.Router();
const {
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  addGeofenceToZone,
  addPoiToZone,
  removeGeofenceFromZone,
  removePoiFromZone,
  getAvailableGeofeatures
} = require('../controllers/zoneController');

// GET /api/zones - Get all zones
router.get('/', getAllZones);

// GET /api/zones/:id - Get single zone
router.get('/:id', getZoneById);

// POST /api/zones - Create new zone
router.post('/', createZone);

// PUT /api/zones/:id - Update zone
router.put('/:id', updateZone);

// DELETE /api/zones/:id - Delete zone
router.delete('/:id', deleteZone);

// GET /api/zones/:id/available - Get available geofeatures for zone
router.get('/:id/available', getAvailableGeofeatures);

// POST /api/zones/:zoneId/geofences/:geofenceId - Add geofence to zone
router.post('/:zoneId/geofences/:geofenceId', addGeofenceToZone);

// POST /api/zones/:zoneId/pois/:poiId - Add POI to zone
router.post('/:zoneId/pois/:poiId', addPoiToZone);

// DELETE /api/zones/:zoneId/geofences/:geofenceId - Remove geofence from zone
router.delete('/:zoneId/geofences/:geofenceId', removeGeofenceFromZone);

// DELETE /api/zones/:zoneId/pois/:poiId - Remove POI from zone
router.delete('/:zoneId/pois/:poiId', removePoiFromZone);

module.exports = router;