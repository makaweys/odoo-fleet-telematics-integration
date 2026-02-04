const Zone = require('../models/Zone');
const Geofence = require('../models/Geofence');
const Poi = require('../models/Poi');

// Get all zones
exports.getAllZones = async (req, res) => {
  try {
    const zones = await Zone.find()
      .populate('assignedGeofeatures.geofences', 'name type path start end')
      .populate('assignedGeofeatures.pois', 'name location radius')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: zones.length,
      data: zones
    });
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch zones'
    });
  }
};

// Get single zone by ID
exports.getZoneById = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id)
      .populate('assignedGeofeatures.geofences', 'name type path start end')
      .populate('assignedGeofeatures.pois', 'name location radius');
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }
    
    res.json({
      success: true,
      data: zone
    });
  } catch (error) {
    console.error('Error fetching zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch zone'
    });
  }
};

// Create new zone
exports.createZone = async (req, res) => {
  try {
    const { name, description, assignedGeofeatures } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Zone name is required'
      });
    }
    
    // Check if zone with same name exists
    const existingZone = await Zone.findOne({ name });
    if (existingZone) {
      return res.status(400).json({
        success: false,
        error: 'Zone with this name already exists'
      });
    }
    
    // Validate assigned geofeatures if provided
    if (assignedGeofeatures) {
      const { geofences = [], pois = [] } = assignedGeofeatures;
      
      // Check if geofences exist
      if (geofences.length > 0) {
        const validGeofences = await Geofence.find({ _id: { $in: geofences } });
        if (validGeofences.length !== geofences.length) {
          return res.status(400).json({
            success: false,
            error: 'One or more geofences do not exist'
          });
        }
      }
      
      // Check if POIs exist
      if (pois.length > 0) {
        const validPois = await Poi.find({ _id: { $in: pois } });
        if (validPois.length !== pois.length) {
          return res.status(400).json({
            success: false,
            error: 'One or more POIs do not exist'
          });
        }
      }
    }
    
    const zone = new Zone({
      name,
      description,
      assignedGeofeatures: assignedGeofeatures || {
        geofences: [],
        pois: []
      }
    });
    
    await zone.save();
    
    // Populate for response
    const populatedZone = await Zone.findById(zone._id)
      .populate('assignedGeofeatures.geofences', 'name type')
      .populate('assignedGeofeatures.pois', 'name location');
    
    // Refresh zone cache
    const { reloadZones } = require('../utils/zoneManager');
    await reloadZones(req.db);
    
    // Emit socket event
    if (req.io) {
      req.io.emit('zone:created', populatedZone);
    }
    
    res.status(201).json({
      success: true,
      message: 'Zone created successfully',
      data: populatedZone
    });
  } catch (error) {
    console.error('Error creating zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create zone'
    });
  }
};

// Update zone
exports.updateZone = async (req, res) => {
  try {
    const { name, description, assignedGeofeatures } = req.body;
    
    const zone = await Zone.findById(req.params.id);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }
    
    // Check if name is being changed and conflicts with another zone
    if (name && name !== zone.name) {
      const existingZone = await Zone.findOne({ name, _id: { $ne: zone._id } });
      if (existingZone) {
        return res.status(400).json({
          success: false,
          error: 'Another zone with this name already exists'
        });
      }
      zone.name = name;
    }
    
    // Update description
    if (description !== undefined) {
      zone.description = description;
    }
    
    // Update assigned geofeatures if provided
    if (assignedGeofeatures !== undefined) {
      const { geofences = [], pois = [] } = assignedGeofeatures;
      
      // Validate geofences
      if (geofences.length > 0) {
        const validGeofences = await Geofence.find({ _id: { $in: geofences } });
        if (validGeofences.length !== geofences.length) {
          return res.status(400).json({
            success: false,
            error: 'One or more geofences do not exist'
          });
        }
      }
      
      // Validate POIs
      if (pois.length > 0) {
        const validPois = await Poi.find({ _id: { $in: pois } });
        if (validPois.length !== pois.length) {
          return res.status(400).json({
            success: false,
            error: 'One or more POIs do not exist'
          });
        }
      }
      
      zone.assignedGeofeatures = assignedGeofeatures;
    }
    
    await zone.save();
    
    // Populate for response
    const populatedZone = await Zone.findById(zone._id)
      .populate('assignedGeofeatures.geofences', 'name type')
      .populate('assignedGeofeatures.pois', 'name location');
    
    // Refresh zone cache
    const { reloadZones } = require('../utils/zoneManager');
    await reloadZones(req.db);
    
    // Emit socket event
    if (req.io) {
      req.io.emit('zone:updated', populatedZone);
    }
    
    res.json({
      success: true,
      message: 'Zone updated successfully',
      data: populatedZone
    });
  } catch (error) {
    console.error('Error updating zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update zone'
    });
  }
};

// Delete zone
exports.deleteZone = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }
    
    // Check if zone is assigned to any vehicles
    const Vehicle = require('../models/Vehicle');
    const vehiclesUsingZone = await Vehicle.find({
      'assignedZones.parentZoneId': zone._id
    });
    
    if (vehiclesUsingZone.length > 0) {
      const vehicleNames = vehiclesUsingZone.map(v => v.name).join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot delete zone. It is assigned to vehicles: ${vehicleNames}`
      });
    }
    
    // Check if zone is used in any trips
    const Trip = require('../models/Trip');
    const tripsUsingZone = await Trip.find({
      'assignedZones.parentZoneId': zone._id
    });
    
    if (tripsUsingZone.length > 0) {
      const tripIds = tripsUsingZone.map(t => t.trip_id).join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot delete zone. It is used in trips: ${tripIds}`
      });
    }
    
    await zone.deleteOne();
    
    // Refresh zone cache
    const { reloadZones } = require('../utils/zoneManager');
    await reloadZones(req.db);
    
    // Emit socket event
    if (req.io) {
      req.io.emit('zone:deleted', { id: req.params.id });
    }
    
    res.json({
      success: true,
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete zone'
    });
  }
};

// Add geofence to zone
exports.addGeofenceToZone = async (req, res) => {
  try {
    const { zoneId, geofenceId } = req.params;
    
    const [zone, geofence] = await Promise.all([
      Zone.findById(zoneId),
      Geofence.findById(geofenceId)
    ]);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }
    
    if (!geofence) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }
    
    // Check if geofence already in zone
    if (zone.assignedGeofeatures.geofences.includes(geofenceId)) {
      return res.status(400).json({
        success: false,
        error: 'Geofence already assigned to this zone'
      });
    }
    
    // Add geofence to zone
    zone.assignedGeofeatures.geofences.push(geofenceId);
    await zone.save();
    
    // Refresh zone cache
    const { reloadZones } = require('../utils/zoneManager');
    await reloadZones(req.db);
    
    // Emit socket event
    if (req.io) {
      req.io.emit('zone:geofence:added', {
        zoneId,
        geofenceId,
        geofenceName: geofence.name
      });
    }
    
    res.json({
      success: true,
      message: 'Geofence added to zone successfully'
    });
  } catch (error) {
    console.error('Error adding geofence to zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add geofence to zone'
    });
  }
};

// Add POI to zone
exports.addPoiToZone = async (req, res) => {
  try {
    const { zoneId, poiId } = req.params;
    
    const [zone, poi] = await Promise.all([
      Zone.findById(zoneId),
      Poi.findById(poiId)
    ]);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }
    
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI not found'
      });
    }
    
    // Check if POI already in zone
    if (zone.assignedGeofeatures.pois.includes(poiId)) {
      return res.status(400).json({
        success: false,
        error: 'POI already assigned to this zone'
      });
    }
    
    // Add POI to zone
    zone.assignedGeofeatures.pois.push(poiId);
    await zone.save();
    
    // Refresh zone cache
    const { reloadZones } = require('../utils/zoneManager');
    await reloadZones(req.db);
    
    // Emit socket event
    if (req.io) {
      req.io.emit('zone:poi:added', {
        zoneId,
        poiId,
        poiName: poi.name
      });
    }
    
    res.json({
      success: true,
      message: 'POI added to zone successfully'
    });
  } catch (error) {
    console.error('Error adding POI to zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add POI to zone'
    });
  }
};

// Remove geofence from zone
exports.removeGeofenceFromZone = async (req, res) => {
  try {
    const { zoneId, geofenceId } = req.params;
    
    const zone = await Zone.findById(zoneId);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }
    
    // Remove geofence from zone
    zone.assignedGeofeatures.geofences = zone.assignedGeofeatures.geofences.filter(
      id => id.toString() !== geofenceId
    );
    
    await zone.save();
    
    // Refresh zone cache
    const { reloadZones } = require('../utils/zoneManager');
    await reloadZones(req.db);
    
    // Emit socket event
    if (req.io) {
      req.io.emit('zone:geofence:removed', { zoneId, geofenceId });
    }
    
    res.json({
      success: true,
      message: 'Geofence removed from zone successfully'
    });
  } catch (error) {
    console.error('Error removing geofence from zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove geofence from zone'
    });
  }
};

// Remove POI from zone
exports.removePoiFromZone = async (req, res) => {
  try {
    const { zoneId, poiId } = req.params;
    
    const zone = await Zone.findById(zoneId);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }
    
    // Remove POI from zone
    zone.assignedGeofeatures.pois = zone.assignedGeofeatures.pois.filter(
      id => id.toString() !== poiId
    );
    
    await zone.save();
    
    // Refresh zone cache
    const { reloadZones } = require('../utils/zoneManager');
    await reloadZones(req.db);
    
    // Emit socket event
    if (req.io) {
      req.io.emit('zone:poi:removed', { zoneId, poiId });
    }
    
    res.json({
      success: true,
      message: 'POI removed from zone successfully'
    });
  } catch (error) {
    console.error('Error removing POI from zone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove POI from zone'
    });
  }
};

// Get available geofeatures for a zone (not already assigned)
exports.getAvailableGeofeatures = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
    }
    
    // Get all geofences and POIs
    const [allGeofences, allPois] = await Promise.all([
      Geofence.find(),
      Poi.find()
    ]);
    
    // Filter out already assigned ones
    const availableGeofences = allGeofences.filter(
      geofence => !zone.assignedGeofeatures.geofences.includes(geofence._id)
    );
    
    const availablePois = allPois.filter(
      poi => !zone.assignedGeofeatures.pois.includes(poi._id)
    );
    
    res.json({
      success: true,
      data: {
        availableGeofences,
        availablePois
      }
    });
  } catch (error) {
    console.error('Error getting available geofeatures:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available geofeatures'
    });
  }
};