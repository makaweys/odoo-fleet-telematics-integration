const Poi = require('../models/Poi');

// Get all POIs
exports.getAllPois = async (req, res) => {
  try {
    const { isCustomer, search } = req.query;
    
    let query = {};
    
    // Filter by customer status
    if (isCustomer !== undefined) {
      query.isCustomer = isCustomer === 'true';
    }
    
    // Search by name or odooCustomerId
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { odooCustomerId: { $regex: search, $options: 'i' } }
      ];
    }
    
    const pois = await Poi.find(query).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: pois.length,
      data: pois
    });
  } catch (error) {
    console.error('Error fetching POIs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch POIs'
    });
  }
};

// Get single POI by ID
exports.getPoiById = async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI not found'
      });
    }
    
    res.json({
      success: true,
      data: poi
    });
  } catch (error) {
    console.error('Error fetching POI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch POI'
    });
  }
};

// Get POI by Odoo customer ID
exports.getPoiByOdooId = async (req, res) => {
  try {
    const poi = await Poi.findOne({ odooCustomerId: req.params.odooId });
    
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI not found'
      });
    }
    
    res.json({
      success: true,
      data: poi
    });
  } catch (error) {
    console.error('Error fetching POI by Odoo ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch POI'
    });
  }
};

// Create new POI
exports.createPoi = async (req, res) => {
  try {
    const { name, description, icon, radius, location, odooCustomerId, isCustomer } = req.body;
    
    // Validate required fields
    if (!name || !location || !location.lat || !location.lng) {
      return res.status(400).json({
        success: false,
        error: 'Name and location (lat, lng) are required'
      });
    }
    
    // Check if POI already exists with same Odoo customer ID
    if (odooCustomerId) {
      const existingPoi = await Poi.findOne({ odooCustomerId });
      if (existingPoi) {
        return res.status(400).json({
          success: false,
          error: 'POI with this Odoo customer ID already exists'
        });
      }
    }
    
    const poi = new Poi({
      name,
      description,
      icon,
      radius: radius || 100, // Default radius 100 meters
      location,
      odooCustomerId,
      isCustomer: isCustomer !== undefined ? isCustomer : false,
      updatedOn: new Date()
    });
    
    await poi.save();
    
    // Emit socket event
    if (req.io) {
      req.io.emit('poi:created', poi);
    }
    
    res.status(201).json({
      success: true,
      message: 'POI created successfully',
      data: poi
    });
  } catch (error) {
    console.error('Error creating POI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create POI'
    });
  }
};

// Update POI
exports.updatePoi = async (req, res) => {
  try {
    const { name, description, icon, radius, location, odooCustomerId, isCustomer } = req.body;
    
    const poi = await Poi.findById(req.params.id);
    
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI not found'
      });
    }
    
    // Check if updating to a duplicate Odoo customer ID
    if (odooCustomerId && odooCustomerId !== poi.odooCustomerId) {
      const existingPoi = await Poi.findOne({ 
        odooCustomerId,
        _id: { $ne: poi._id }
      });
      if (existingPoi) {
        return res.status(400).json({
          success: false,
          error: 'Another POI with this Odoo customer ID already exists'
        });
      }
    }
    
    // Update fields
    poi.name = name || poi.name;
    poi.description = description !== undefined ? description : poi.description;
    poi.icon = icon !== undefined ? icon : poi.icon;
    poi.radius = radius !== undefined ? radius : poi.radius;
    poi.odooCustomerId = odooCustomerId !== undefined ? odooCustomerId : poi.odooCustomerId;
    poi.isCustomer = isCustomer !== undefined ? isCustomer : poi.isCustomer;
    poi.updatedOn = new Date();
    
    // Update location if provided
    if (location) {
      if (!location.lat || !location.lng) {
        return res.status(400).json({
          success: false,
          error: 'Location must include both lat and lng'
        });
      }
      poi.location = location;
    }
    
    await poi.save();
    
    // Emit socket event
    if (req.io) {
      req.io.emit('poi:updated', poi);
    }
    
    res.json({
      success: true,
      message: 'POI updated successfully',
      data: poi
    });
  } catch (error) {
    console.error('Error updating POI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update POI'
    });
  }
};

// Delete POI
exports.deletePoi = async (req, res) => {
  try {
    const poi = await Poi.findById(req.params.id);
    
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI not found'
      });
    }
    
    // Check if POI is being used in any zones
    const Zone = require('../models/Zone');
    const zonesUsingPoi = await Zone.find({
      'assignedGeofeatures.pois': poi._id
    });
    
    if (zonesUsingPoi.length > 0) {
      const zoneNames = zonesUsingPoi.map(z => z.name).join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot delete POI. It is being used in zones: ${zoneNames}`
      });
    }
    
    await poi.deleteOne();
    
    // Emit socket event
    if (req.io) {
      req.io.emit('poi:deleted', { id: req.params.id });
    }
    
    res.json({
      success: true,
      message: 'POI deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting POI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete POI'
    });
  }
};

// Batch create/update POIs from Odoo customers
exports.batchSyncPois = async (req, res) => {
  try {
    const { customers } = req.body;
    
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Customers array is required'
      });
    }
    
    const results = {
      created: 0,
      updated: 0,
      errors: []
    };
    
    for (const customer of customers) {
      try {
        const { odooCustomerId, name, latitude, longitude, address } = customer;
        
        if (!odooCustomerId || !name) {
          results.errors.push({
            customer,
            error: 'Missing odooCustomerId or name'
          });
          continue;
        }
        
        const location = {
          lat: parseFloat(latitude) || 0,
          lng: parseFloat(longitude) || 0
        };
        
        // Find existing POI or create new
        const existingPoi = await Poi.findOne({ odooCustomerId });
        
        if (existingPoi) {
          // Update existing
          existingPoi.name = name;
          existingPoi.location = location;
          existingPoi.updatedOn = new Date();
          await existingPoi.save();
          results.updated++;
        } else {
          // Create new
          const poi = new Poi({
            odooCustomerId,
            name,
            description: address || '',
            location,
            radius: 100,
            isCustomer: true,
            updatedOn: new Date()
          });
          await poi.save();
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          customer,
          error: error.message
        });
      }
    }
    
    // Refresh zone cache after batch update
    if (req.io) {
      const { reloadZones } = require('../utils/zoneManager');
      await reloadZones(req.db);
      req.io.emit('pois:batch:synced', results);
    }
    
    res.json({
      success: true,
      message: 'POIs batch sync completed',
      data: results
    });
  } catch (error) {
    console.error('Error in batch POI sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch sync POIs'
    });
  }
};

/**
 * Sync POI from Odoo customer (for customer creation/update automation)
 * This endpoint matches exactly what your Odoo automation is calling
 */
exports.syncPoiFromOdooCustomer = async (req, res) => {
  try {
    const { odooCustomerId, name, route, latitude, longitude, address } = req.body;
    
    console.log('Syncing POI from Odoo customer:', {
      odooCustomerId,
      name,
      route
    });

    // Validate required fields
    if (!odooCustomerId || !name) {
      return res.status(400).json({
        success: false,
        error: 'odooCustomerId and name are required'
      });
    }

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'latitude and longitude are required'
      });
    }

    // Convert coordinates to numbers
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    // Validate coordinate ranges
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude. Must be between -90 and 90'
      });
    }
    
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid longitude. Must be between -180 and 180'
      });
    }

    let poi;
    if (req.db.connected) {
      // Check if POI already exists for this Odoo customer
      poi = await Poi.findOne({ odooCustomerId });
      
      if (poi) {
        // Update existing POI
        poi.name = name;
        poi.location = { lat, lng };
        poi.description = route || address || poi.description;
        poi.isCustomer = true;
        poi.updatedOn = new Date();
        
        await poi.save();
        
        console.log(`Updated existing POI for Odoo customer ${odooCustomerId}`);
      } else {
        // Create new POI
        poi = new Poi({
          odooCustomerId,
          name,
          description: route || address || '',
          location: { lat, lng },
          radius: 100, // Default radius for customer locations
          isCustomer: true,
          updatedOn: new Date()
        });
        
        await poi.save();
        
        console.log(`Created new POI for Odoo customer ${odooCustomerId}`);
      }
    } else {
      // Dummy mode - create mock POI
      poi = {
        _id: `dummy_${odooCustomerId}`,
        odooCustomerId,
        name,
        description: route || '',
        location: { lat, lng },
        radius: 100,
        isCustomer: true,
        updatedOn: new Date()
      };
      
      console.log(`Dummy mode: Created POI for Odoo customer ${odooCustomerId}`);
    }

    // Refresh zone cache after POI update
    if (req.io && req.db.connected) {
      const { reloadZones } = require('../utils/zoneManager');
      await reloadZones(req.db);
      
      // Emit socket event for real-time update
      req.io.emit('poi:odoo:synced', {
        poiId: poi._id,
        odooCustomerId,
        name,
        location: { lat, lng },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: poi._id?.toString().startsWith('dummy_') 
        ? 'POI synced (dummy mode)' 
        : 'POI synced successfully',
      data: {
        poiId: poi._id,
        odooCustomerId: poi.odooCustomerId,
        name: poi.name,
        location: poi.location,
        isCustomer: poi.isCustomer,
        updatedOn: poi.updatedOn
      }
    });

  } catch (error) {
    console.error('Error syncing POI from Odoo customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync POI from Odoo customer',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * Bulk sync POIs from Odoo customers (for initial migration or batch updates)
 */
exports.bulkSyncPoisFromOdoo = async (req, res) => {
  try {
    const { customers } = req.body;
    
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'customers array is required and cannot be empty'
      });
    }

    const results = {
      total: customers.length,
      created: 0,
      updated: 0,
      errors: [],
      skipped: 0
    };

    for (const customer of customers) {
      try {
        const { odooCustomerId, name, latitude, longitude, route, address } = customer;
        
        // Skip if missing required fields
        if (!odooCustomerId || !name || !latitude || !longitude) {
          results.errors.push({
            customer,
            error: 'Missing required fields (odooCustomerId, name, latitude, or longitude)'
          });
          results.skipped++;
          continue;
        }

        // Validate coordinates
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        if (isNaN(lat) || lat < -90 || lat > 90 || 
            isNaN(lng) || lng < -180 || lng > 180) {
          results.errors.push({
            customer,
            error: 'Invalid coordinates'
          });
          results.skipped++;
          continue;
        }

        if (req.db.connected) {
          // Find existing POI
          let poi = await Poi.findOne({ odooCustomerId });
          
          if (poi) {
            // Update existing
            poi.name = name;
            poi.location = { lat, lng };
            poi.description = route || address || poi.description;
            poi.isCustomer = true;
            poi.updatedOn = new Date();
            await poi.save();
            results.updated++;
          } else {
            // Create new
            poi = new Poi({
              odooCustomerId,
              name,
              description: route || address || '',
              location: { lat, lng },
              radius: 100,
              isCustomer: true,
              updatedOn: new Date()
            });
            await poi.save();
            results.created++;
          }
        } else {
          // Dummy mode - just count
          results.created++;
        }
        
      } catch (error) {
        results.errors.push({
          customer,
          error: error.message
        });
        results.skipped++;
      }
    }

    // Refresh zone cache after bulk update
    if (req.io && req.db.connected) {
      const { reloadZones } = require('../utils/zoneManager');
      await reloadZones(req.db);
      
      req.io.emit('pois:bulk:synced', {
        total: results.total,
        created: results.created,
        updated: results.updated,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: `Bulk sync completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`,
      data: results
    });

  } catch (error) {
    console.error('Error in bulk POI sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk sync POIs'
    });
  }
};

/**
 * Get POIs by Odoo customer IDs
 */
exports.getPoisByOdooCustomerIds = async (req, res) => {
  try {
    const { customerIds } = req.body;
    
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'customerIds array is required'
      });
    }

    let pois = [];
    if (req.db.connected) {
      pois = await Poi.find({ 
        odooCustomerId: { $in: customerIds } 
      });
    } else {
      // Return dummy POIs
      pois = customerIds.map(id => ({
        _id: `dummy_${id}`,
        odooCustomerId: id,
        name: `Customer ${id}`,
        location: { 
          lat: -1.2921 + (Math.random() * 0.1 - 0.05),
          lng: 36.8219 + (Math.random() * 0.1 - 0.05)
        },
        radius: 100,
        isCustomer: true
      }));
    }

    res.json({
      success: true,
      count: pois.length,
      data: pois
    });

  } catch (error) {
    console.error('Error getting POIs by Odoo customer IDs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get POIs'
    });
  }
};

