const Vehicle = require("../models/Vehicle");
const Zone = require("../models/Zone");

// Get all vehicles with latest locations
exports.getAllVehicles = async (req, res) => {
  try {
    // If MongoDB is not connected, use dummy data
    if (!req.db.connected) {
      const dummyVehicles = generateDummyVehicles();
      return res.json({
        success: true,
        data: dummyVehicles,
        count: dummyVehicles.length,
        message: "Using dummy data (MongoDB not connected)"
      });
    }

    const vehicles = await Vehicle.find()
      .populate("lastLocation")
      .populate("assignedZones.parentZoneId", "name")
      .populate("assignedZones.geofences", "name")
      .populate("assignedZones.pois", "name")
      .sort({ updatedAt: -1 });
    
    res.json({
      success: true,
      data: vehicles,
      count: vehicles.length
    });
  } catch (err) {
    console.error("Error fetching vehicles:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch vehicles",
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
  }
};

// Get vehicle by ID
exports.getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.db.connected) {
      const dummyVehicle = generateDummyVehicle(id);
      return res.json({
        success: true,
        data: dummyVehicle,
        message: "Using dummy data"
      });
    }

    const vehicle = await Vehicle.findById(id)
      .populate("lastLocation")
      .populate("assignedZones.parentZoneId", "name")
      .populate("assignedZones.geofences", "name")
      .populate("assignedZones.pois", "name");
    
    if (!vehicle) {
      return res.status(404).json({ 
        success: false,
        error: "Vehicle not found" 
      });
    }
    
    res.json({
      success: true,
      data: vehicle
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get vehicle by Odoo ID
exports.getVehicleByOdooId = async (req, res) => {
  try {
    const { odooId } = req.params;
    
    if (!req.db.connected) {
      const dummyVehicle = generateDummyVehicle(`odoo_${odooId}`);
      dummyVehicle.odooVehicleId = parseInt(odooId);
      return res.json({
        success: true,
        data: dummyVehicle,
        message: "Using dummy data"
      });
    }

    const vehicle = await Vehicle.findOne({ odooVehicleId: odooId })
      .populate("lastLocation")
      .populate("assignedZones.parentZoneId", "name")
      .populate("assignedZones.geofences", "name")
      .populate("assignedZones.pois", "name");
    
    if (!vehicle) {
      return res.status(404).json({ 
        success: false,
        error: "Vehicle not found" 
      });
    }
    
    res.json({
      success: true,
      data: vehicle
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    if (!req.db.connected) {
      return res.json({
        success: true,
        data: {
          totalDistanceToday: 0,
          totalViolations: 0,
          batteryAlerts: 0,
          totalVehicles: 2,
          onlineVehicles: 1,
          message: "Using dummy data"
        }
      });
    }

    const vehicles = await Vehicle.find().populate("lastLocation");

    // Calculate online vehicles (last location within 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const onlineVehicles = vehicles.filter(v => 
      v.lastLocation && 
      v.lastLocation.timestamp && 
      new Date(v.lastLocation.timestamp) > tenMinutesAgo
    ).length;

    // Calculate low battery vehicles (battery < 30%)
    const lowBatteryVehicles = vehicles.filter(v => 
      v.lastLocation && 
      v.lastLocation.battery && 
      v.lastLocation.battery.level < 0.3
    ).length;

    // Calculate total distance (dummy calculation)
    const totalDistanceToday = vehicles.reduce((sum, v) => {
      return sum + (v.lastLocation?.odometer || 0);
    }, 0);

    // Get violations from last 24 hours
    const Violation = require("../models/Violation");
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const totalViolations = await Violation.countDocuments({
      timestamp: { $gte: yesterday }
    });

    res.json({
      success: true,
      data: {
        totalDistanceToday,
        totalViolations,
        batteryAlerts: lowBatteryVehicles,
        totalVehicles: vehicles.length,
        onlineVehicles,
        lowBatteryVehicles
      }
    });
  } catch (err) {
    console.error("Dashboard stat error:", err);
    res.status(500).json({ 
      success: false,
      error: "Server error" 
    });
  }
};

// Get online vehicles
exports.getOnlineVehicles = async (req, res) => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    if (!req.db.connected) {
      const dummyVehicles = generateDummyVehicles();
      // Mark first vehicle as "online" (recent timestamp)
      dummyVehicles[0].lastLocation.timestamp = new Date();
      return res.json({
        success: true,
        data: {
          onlineVehicles: [dummyVehicles[0]],
          count: 1,
          message: "Using dummy data"
        }
      });
    }

    const onlineVehicles = await Vehicle.find({
      "lastLocation.timestamp": { $gte: tenMinutesAgo }
    })
    .populate("lastLocation")
    .populate("assignedZones.parentZoneId", "name");

    res.json({
      success: true,
      data: {
        onlineVehicles,
        count: onlineVehicles.length
      }
    });
  } catch (err) {
    console.error("Error getting online vehicles:", err);
    res.status(500).json({ 
      success: false,
      error: "Server error" 
    });
  }
};

// Get low battery vehicles
exports.getLowBatteryVehicles = async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 0.3;

    if (!req.db.connected) {
      const dummyVehicles = generateDummyVehicles();
      // Mark second vehicle as low battery
      dummyVehicles[1].lastLocation.battery.level = 0.2;
      return res.json({
        success: true,
        data: {
          lowBatteryVehicles: [dummyVehicles[1]],
          count: 1,
          threshold,
          message: "Using dummy data"
        }
      });
    }

    const lowBatteryVehicles = await Vehicle.find({
      "lastLocation.battery.level": { $lte: threshold }
    })
    .populate("lastLocation")
    .populate("assignedZones.parentZoneId", "name");

    res.json({
      success: true,
      data: {
        lowBatteryVehicles,
        count: lowBatteryVehicles.length,
        threshold
      }
    });
  } catch (error) {
    console.error("Error fetching low battery vehicles:", error);
    res.status(500).json({ 
      success: false,
      error: "Server error" 
    });
  }
};

// Assign zones to vehicle
exports.assignZonesToVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { zoneIds = [] } = req.body;

    if (!req.db.connected) {
      return res.json({
        success: true,
        data: {
          vehicleId,
          assignedZones: zoneIds.map(id => ({ zoneId: id, name: `Zone ${id}` })),
          message: "Using dummy data - zones would be assigned in real mode"
        }
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false,
        error: "Vehicle not found" 
      });
    }

    // Fetch selected zones and their geofeatures
    const zones = await Zone.find({ _id: { $in: zoneIds } })
      .populate("assignedGeofeatures.geofences", "_id name")
      .populate("assignedGeofeatures.pois", "_id name");

    const assignedZones = zones.map((zone) => ({
      parentZoneId: zone._id,
      geofences: zone.assignedGeofeatures.geofences.map((g) => g._id),
      pois: zone.assignedGeofeatures.pois.map((p) => p._id),
    }));

    vehicle.assignedZones = assignedZones;
    await vehicle.save();

    // Emit socket event
    if (req.io) {
      req.io.emit("vehicle:zones:assigned", {
        vehicleId,
        assignedZones: vehicle.assignedZones,
      });
    }

    res.json({
      success: true,
      data: {
        vehicleId,
        assignedZones: vehicle.assignedZones,
        message: "Zones assigned successfully"
      }
    });
  } catch (err) {
    console.error("Error assigning zones:", err);
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error" 
    });
  }
};

// Get assigned zones for vehicle
exports.getAssignedZones = async (req, res) => {
  const { vehicleId } = req.params;

  try {
    if (!req.db.connected) {
      return res.json({
        success: true,
        data: {
          vehicleId,
          assignedZones: [
            {
              parentZoneId: "dummy_zone_1",
              parentZoneName: "Dummy Zone 1",
              zone_id: "dummy_geofence_1",
              type: "geo",
              name: "Dummy Geofence"
            }
          ],
          message: "Using dummy data"
        }
      });
    }

    const vehicle = await Vehicle.findById(vehicleId)
      .populate("assignedZones.geofences", "_id name")
      .populate("assignedZones.pois", "_id name")
      .populate("assignedZones.parentZoneId", "_id name");

    if (!vehicle) {
      return res.status(404).json({ 
        success: false,
        error: "Vehicle not found" 
      });
    }

    const assignedZones = [];

    for (const zoneAssignment of vehicle.assignedZones || []) {
      const { parentZoneId, geofences = [], pois = [] } = zoneAssignment;
      
      if (geofences?.length > 0) {
        geofences.forEach((geo) => {
          assignedZones.push({
            parentZoneId: parentZoneId?._id,
            parentZoneName: parentZoneId?.name,
            zone_id: geo._id,
            type: "geo",
            name: geo.name,
          });
        });
      }

      if (pois?.length > 0) {
        pois.forEach((poi) => {
          assignedZones.push({
            parentZoneId: parentZoneId?._id,
            parentZoneName: parentZoneId?.name,
            zone_id: poi._id,
            type: "poi",
            name: poi.name,
          });
        });
      }
    }

    return res.json({
      success: true,
      data: {
        vehicleId,
        assignedZones
      }
    });
  } catch (err) {
    console.error("Error fetching assigned zones:", err);
    return res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
};

// Odoo sync endpoint (keep for your integration)
exports.syncOdooVehicle = async (req, res) => {
  try {
    const { odooVehicleId, name, licensePlate, deviceId } = req.body;

    if (!req.db.connected) {
      const dummyVehicle = generateDummyVehicle(`odoo_${odooVehicleId}`);
      dummyVehicle.odooVehicleId = odooVehicleId;
      dummyVehicle.name = name;
      dummyVehicle.licensePlate = licensePlate;
      dummyVehicle.deviceId = deviceId;
      
      return res.json({ 
        success: true, 
        data: dummyVehicle,
        message: "Using dummy data - vehicle would be synced in real mode"
      });
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { odooVehicleId },
      { 
        name, 
        licensePlate, 
        deviceId, 
        lastSync: new Date() 
      },
      { new: true, upsert: true }
    );

    // Emit socket event
    if (req.io) {
      req.io.emit("vehicle:updated", vehicle);
    }

    res.json({ 
      success: true, 
      data: vehicle 
    });
  } catch (err) {
    console.error("Odoo sync error:", err);
    res.status(500).json({ 
      success: false,
      error: "Sync failed" 
    });
  }
};

// Dummy data generators (for fallback)
const generateDummyVehicles = () => {
  return [
    {
      _id: "dummy_1",
      odooVehicleId: 1001,
      name: "Delivery Truck 01",
      licensePlate: "ABC-123",
      deviceId: "device_001",
      traccarId: "traccar_001",
      driverName: "John Doe",
      assignedZones: [],
      lastLocation: {
        latitude: -1.2921,
        longitude: 36.8219,
        speed: 45,
        timestamp: new Date(),
        battery: { 
          level: 0.75,
          is_charging: false 
        },
        accuracy: 10,
        altitude: 1600,
        motion: true
      }
    },
    {
      _id: "dummy_2",
      odooVehicleId: 1002,
      name: "Bakery Van 02",
      licensePlate: "XYZ-789",
      deviceId: "device_002",
      traccarId: "traccar_002",
      driverName: "Jane Smith",
      assignedZones: [],
      lastLocation: {
        latitude: -1.3000,
        longitude: 36.8000,
        speed: 60,
        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        battery: { 
          level: 0.25,
          is_charging: true 
        },
        accuracy: 15,
        altitude: 1550,
        motion: false
      }
    }
  ];
};

const generateDummyVehicle = (id) => {
  return {
    _id: id,
    odooVehicleId: Math.floor(Math.random() * 1000),
    name: `Vehicle ${id}`,
    licensePlate: `DUMMY-${id.substring(0, 4)}`,
    deviceId: `device_${id}`,
    traccarId: `traccar_${id}`,
    driverName: "Test Driver",
    assignedZones: [],
    lastLocation: {
      latitude: -1.2921 + (Math.random() * 0.1 - 0.05),
      longitude: 36.8219 + (Math.random() * 0.1 - 0.05),
      speed: Math.random() * 100,
      timestamp: new Date(),
      battery: { 
        level: Math.random(),
        is_charging: Math.random() > 0.5 
      },
      accuracy: 5 + Math.random() * 20,
      altitude: 1500 + Math.random() * 200,
      motion: Math.random() > 0.3
    }
  };
};