const express = require('express');
const router = express.Router();
const {
  getAllPois,
  getPoiById,
  getPoiByOdooId,
  createPoi,
  updatePoi,
  deletePoi,
  batchSyncPois
} = require('../controllers/poiController');

// GET /api/pois - Get all POIs with optional filters
router.get('/', getAllPois);

// GET /api/pois/:id - Get single POI by ID
router.get('/:id', getPoiById);

// GET /api/pois/odoo/:odooId - Get POI by Odoo customer ID
router.get('/odoo/:odooId', getPoiByOdooId);

// POST /api/pois - Create new POI
router.post('/', createPoi);

// PUT /api/pois/:id - Update POI
router.put('/:id', updatePoi);

// DELETE /api/pois/:id - Delete POI
router.delete('/:id', deletePoi);

// POST /api/pois/batch-sync - Batch sync POIs from Odoo
router.post('/batch-sync', batchSyncPois);

module.exports = router;