const express = require('express');
const router = express.Router();
const {
  getAllGeofences,
  getGeofenceById,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  getGeofencesInBounds
} = require('../controllers/geofenceController');

// GET /api/geofences - Get all geofences
router.get('/', getAllGeofences);

// GET /api/geofences/bounds - Get geofences within map bounds
router.get('/bounds', getGeofencesInBounds);

// GET /api/geofences/:id - Get single geofence
router.get('/:id', getGeofenceById);

// POST /api/geofences - Create new geofence
router.post('/', createGeofence);

// PUT /api/geofences/:id - Update geofence
router.put('/:id', updateGeofence);

// DELETE /api/geofences/:id - Delete geofence
router.delete('/:id', deleteGeofence);

module.exports = router;