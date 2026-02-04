const Geofence = require('../models/Geofence');

// Get all geofences
exports.getAllGeofences = async (req, res) => {
  try {
    const geofences = await Geofence.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: geofences.length,
      data: geofences
    });
  } catch (error) {
    console.error('Error fetching geofences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch geofences'
    });
  }
};

// Get single geofence by ID
exports.getGeofenceById = async (req, res) => {
  try {
    const geofence = await Geofence.findById(req.params.id);
    
    if (!geofence) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }
    
    res.json({
      success: true,
      data: geofence
    });
  } catch (error) {
    console.error('Error fetching geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch geofence'
    });
  }
};

// Create new geofence
exports.createGeofence = async (req, res) => {
  try {
    const { name, description, type, start, end, path, routePolyline } = req.body;
    
    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name and type are required'
      });
    }
    
    // For polygon geofences, validate path
    if (type === 'polygon' && (!path || path.length < 3)) {
      return res.status(400).json({
        success: false,
        error: 'Polygon geofence requires at least 3 points in path'
      });
    }
    
    // For route geofences, validate start and end
    if (type === 'route' && (!start || !end)) {
      return res.status(400).json({
        success: false,
        error: 'Route geofence requires start and end points'
      });
    }
    
    const geofence = new Geofence({
      name,
      description,
      type,
      start,
      end,
      path,
      routePolyline,
      createdBy: req.user?._id // Assuming you have user authentication
    });
    
    await geofence.save();
    
    // Emit socket event for real-time update
    if (req.io) {
      req.io.emit('geofence:created', geofence);
    }
    
    res.status(201).json({
      success: true,
      message: 'Geofence created successfully',
      data: geofence
    });
  } catch (error) {
    console.error('Error creating geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create geofence'
    });
  }
};

// Update geofence
exports.updateGeofence = async (req, res) => {
  try {
    const { name, description, type, start, end, path, routePolyline } = req.body;
    
    const geofence = await Geofence.findById(req.params.id);
    
    if (!geofence) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }
    
    // Update fields
    geofence.name = name || geofence.name;
    geofence.description = description !== undefined ? description : geofence.description;
    
    // Only update type-specific fields if type is provided
    if (type) {
      geofence.type = type;
      
      if (type === 'polygon' && path) {
        if (path.length < 3) {
          return res.status(400).json({
            success: false,
            error: 'Polygon geofence requires at least 3 points in path'
          });
        }
        geofence.path = path;
        geofence.start = null;
        geofence.end = null;
        geofence.routePolyline = null;
      } else if (type === 'route') {
        if (!start || !end) {
          return res.status(400).json({
            success: false,
            error: 'Route geofence requires start and end points'
          });
        }
        geofence.start = start;
        geofence.end = end;
        geofence.routePolyline = routePolyline || geofence.routePolyline;
        geofence.path = null;
      }
    }
    
    await geofence.save();
    
    // Emit socket event
    if (req.io) {
      req.io.emit('geofence:updated', geofence);
    }
    
    res.json({
      success: true,
      message: 'Geofence updated successfully',
      data: geofence
    });
  } catch (error) {
    console.error('Error updating geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update geofence'
    });
  }
};

// Delete geofence
exports.deleteGeofence = async (req, res) => {
  try {
    const geofence = await Geofence.findById(req.params.id);
    
    if (!geofence) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }
    
    // Check if geofence is being used in any zones
    const Zone = require('../models/Zone');
    const zonesUsingGeofence = await Zone.find({
      'assignedGeofeatures.geofences': geofence._id
    });
    
    if (zonesUsingGeofence.length > 0) {
      const zoneNames = zonesUsingGeofence.map(z => z.name).join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot delete geofence. It is being used in zones: ${zoneNames}`
      });
    }
    
    await geofence.deleteOne();
    
    // Emit socket event
    if (req.io) {
      req.io.emit('geofence:deleted', { id: req.params.id });
    }
    
    res.json({
      success: true,
      message: 'Geofence deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete geofence'
    });
  }
};

// Get geofences within bounds (for map view)
exports.getGeofencesInBounds = async (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng } = req.query;
    
    if (!neLat || !neLng || !swLat || !swLng) {
      return res.status(400).json({
        success: false,
        error: 'Bounds coordinates are required'
      });
    }
    
    // Convert to numbers
    const bounds = {
      ne: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
      sw: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
    };
    
    // Get all geofences and filter client-side for now
    // In production, you might want to use MongoDB geospatial queries
    const geofences = await Geofence.find();
    
    // Filter geofences that intersect with bounds
    const filteredGeofences = geofences.filter(geofence => {
      if (geofence.type === 'polygon' && geofence.path) {
        // Check if any point of polygon is within bounds
        return geofence.path.some(point => 
          point.lat >= bounds.sw.lat && point.lat <= bounds.ne.lat &&
          point.lng >= bounds.sw.lng && point.lng <= bounds.ne.lng
        );
      } else if (geofence.type === 'route' && geofence.start && geofence.end) {
        // Check if start or end is within bounds
        return (
          (geofence.start.lat >= bounds.sw.lat && geofence.start.lat <= bounds.ne.lat &&
           geofence.start.lng >= bounds.sw.lng && geofence.start.lng <= bounds.ne.lng) ||
          (geofence.end.lat >= bounds.sw.lat && geofence.end.lat <= bounds.ne.lat &&
           geofence.end.lng >= bounds.sw.lng && geofence.end.lng <= bounds.ne.lng)
        );
      }
      return false;
    });
    
    res.json({
      success: true,
      count: filteredGeofences.length,
      data: filteredGeofences
    });
  } catch (error) {
    console.error('Error fetching geofences in bounds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch geofences in bounds'
    });
  }
};