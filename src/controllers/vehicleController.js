const Vehicle = require("../models/Vehicle");

// Get all vehicles with latest locations
exports.getAllVehicles = async (req, res) => {
  try {
    // If MongoDB is not connected, use dummy data
    if (!req.db.connected) {
      const dummyVehicles = generateDummyVehicles();
      return res.json(dummyVehicles);
    }

    const vehicles = await Vehicle.find()
      .populate("lastLocation")
      .sort({ updatedAt: -1 });
    
    res.json(vehicles);
  } catch (err) {
    console.error("Error fetching vehicles:", err);
    res.status(500).json({ 
      error: "Failed to fetch vehicles",
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
  }
};

// Odoo sync endpoint (keep for your integration)
exports.syncOdooVehicle = async (req, res) => {
  try {
    const { odooVehicleId, name, licensePlate, deviceId } = req.body;

    if (!req.db.connected) {
      return res.status(503).json({ 
        error: "Database not available in dummy mode" 
      });
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { odooVehicleId },
      { name, licensePlate, deviceId, lastSync: new Date() },
      { new: true, upsert: true }
    );

    // Emit socket event
    if (req.io) {
      req.io.emit("vehicle:updated", vehicle);
    }

    res.json({ success: true, vehicle });
  } catch (err) {
    console.error("Odoo sync error:", err);
    res.status(500).json({ error: "Sync failed" });
  }
};

// Get vehicle by ID
exports.getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.db.connected) {
      const dummyVehicle = generateDummyVehicle(id);
      return res.json(dummyVehicle);
    }

    const vehicle = await Vehicle.findById(id).populate("lastLocation");
    
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Dummy data generators (for fallback)
const generateDummyVehicles = () => {
  return [
    {
      _id: "dummy_1",
      name: "Vehicle 1",
      licensePlate: "ABC-123",
      deviceId: "device_001",
      lastLocation: {
        latitude: -1.2921,
        longitude: 36.8219,
        speed: 45,
        timestamp: new Date(),
        battery: { level: 0.75 }
      }
    },
    {
      _id: "dummy_2",
      name: "Vehicle 2",
      licensePlate: "XYZ-789",
      deviceId: "device_002",
      lastLocation: {
        latitude: -1.3000,
        longitude: 36.8000,
        speed: 60,
        timestamp: new Date(Date.now() - 300000),
        battery: { level: 0.45 }
      }
    }
  ];
};

const generateDummyVehicle = (id) => {
  return {
    _id: id,
    name: `Vehicle ${id}`,
    licensePlate: `DUMMY-${id}`,
    lastLocation: {
      latitude: -1.2921 + (Math.random() * 0.1 - 0.05),
      longitude: 36.8219 + (Math.random() * 0.1 - 0.05),
      speed: Math.random() * 100,
      timestamp: new Date(),
      battery: { level: Math.random() }
    }
  };
};