const express = require("express");
const router = express.Router();
const {
  getAllVehicles,
  getVehicleById,
  syncOdooVehicle
} = require("../controllers/vehicleController");

// GET /api/vehicles - Get all vehicles with latest locations
router.get("/", getAllVehicles);

// GET /api/vehicles/:id - Get specific vehicle
router.get("/:id", getVehicleById);

// POST /api/vehicles/sync - Odoo sync endpoint
router.post("/sync", syncOdooVehicle);

module.exports = router;