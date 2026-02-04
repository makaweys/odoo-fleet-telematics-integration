const Vehicle = require('../models/Vehicle');
const Zone = require('../models/Zone');
const Poi = require('../models/Poi');
const Trip = require('../models/Trip');

class OdooService {
  constructor() {
    this.activeTrips = new Map(); // Track active trips by vehicle
  }

  /**
   * Process Odoo vehicle sync
   * Called when vehicle is created/updated in Odoo
   */
  async syncVehicleFromOdoo(data, db, io) {
    try {
      console.log('Processing Odoo vehicle sync:', {
        odooVehicleId: data.odooVehicleId,
        name: data.name
      });

      // Validate required fields
      if (!data.odooVehicleId) {
        throw new Error('odooVehicleId is required');
      }

      let vehicle;
      if (db.connected) {
        // Find or create vehicle in MongoDB
        vehicle = await Vehicle.findOneAndUpdate(
          { odooVehicleId: data.odooVehicleId },
          {
            name: data.name || '',
            licensePlate: data.licensePlate || '',
            type: data.type || '',
            driverName: data.driverName || '',
            driverId: data.driverId || null,
            traccarId: data.traccarId || '',
            deviceId: data.deviceId || ''
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
          }
        );
      } else {
        // Dummy vehicle for testing
        vehicle = this.createDummyVehicle(data);
      }

      // Emit update to connected clients
      if (io) {
        io.emit('vehicle:synced', {
          vehicleId: vehicle._id,
          odooVehicleId: vehicle.odooVehicleId,
          name: vehicle.name,
          licensePlate: vehicle.licensePlate,
          driverName: vehicle.driverName,
          timestamp: new Date()
        });
      }

      return {
        success: true,
        message: 'Vehicle synced successfully',
        vehicle: {
          _id: vehicle._id,
          odooVehicleId: vehicle.odooVehicleId,
          name: vehicle.name,
          licensePlate: vehicle.licensePlate,
          traccarId: vehicle.traccarId,
          deviceId: vehicle.deviceId
        }
      };

    } catch (error) {
      console.error('Error syncing vehicle from Odoo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process Odoo trip assignment
   * Called when a trip is created/activated in Odoo
   */
  async assignTripFromOdoo(data, db, io) {
    try {
      console.log('Processing Odoo trip assignment:', {
        tripId: data.x_studio_trip_id,
        odooVehicleId: data.odooVehicleId,
        zoneId: data.zoneId
      });

      // Validate required fields
      if (!data.odooVehicleId || !data.zoneId || !data.x_studio_trip_id) {
        throw new Error('odooVehicleId, zoneId, and x_studio_trip_id are required');
      }

      let vehicle;
      let zone;
      let pois = [];

      if (db.connected) {
        // Find vehicle
        vehicle = await Vehicle.findOne({ odooVehicleId: data.odooVehicleId });
        if (!vehicle) {
          throw new Error(`Vehicle with odooVehicleId ${data.odooVehicleId} not found`);
        }

        // Find zone
        zone = await Zone.findById(data.zoneId)
          .populate('assignedGeofeatures.geofences', '_id name')
          .populate('assignedGeofeatures.pois', '_id name');

        if (!zone) {
          throw new Error(`Zone with ID ${data.zoneId} not found`);
        }

        // Find POIs for customer IDs
        if (data.odooCustomerIds && data.odooCustomerIds.length > 0) {
          pois = await Poi.find({ 
            odooCustomerId: { $in: data.odooCustomerIds } 
          });
        }

        // Check if vehicle already has an active trip
        const existingActiveTrip = await Trip.findOne({
          vehicleId: vehicle._id,
          completed: false
        });

        if (existingActiveTrip) {
          console.log(`Vehicle ${vehicle.name} already has active trip ${existingActiveTrip.trip_id}`);
          // You could choose to complete the existing trip or throw an error
          // For now, we'll complete it
          existingActiveTrip.completed = true;
          existingActiveTrip.completedAt = new Date();
          await existingActiveTrip.save();
        }

        // Create assigned zones structure
        const assignedZones = [{
          parentZoneId: zone._id,
          geofences: zone.assignedGeofeatures.geofences.map(g => g._id),
          pois: [
            ...new Set([
              ...zone.assignedGeofeatures.pois.map(p => p._id),
              ...pois.map(p => p._id)
            ])
          ]
        }];

        // Update vehicle with trip information
        vehicle.trip_id = data.x_studio_trip_id;
        vehicle.trip_details = {
          invoices_count: data.invoices_count || 0,
          total_value: data.total_value || 0,
          invoices: data.invoices || []
        };
        vehicle.assignedZones = assignedZones;
        await vehicle.save();

        // Create or update trip record
        let trip = await Trip.findOne({
          trip_id: data.x_studio_trip_id,
          vehicleId: vehicle._id
        });

        if (trip) {
          // Update existing trip
          trip.trip_details = vehicle.trip_details;
          trip.assignedZones = assignedZones;
          await trip.save();
          console.log('Trip updated:', trip._id);
        } else {
          // Create new trip
          trip = new Trip({
            vehicleId: vehicle._id,
            trip_id: data.x_studio_trip_id,
            trip_details: vehicle.trip_details,
            assignedZones: assignedZones,
            completed: false
          });
          await trip.save();
          console.log('New trip created:', trip._id);
        }

        // Track active trip
        this.activeTrips.set(vehicle._id.toString(), {
          tripId: trip._id,
          odooTripId: data.x_studio_trip_id,
          assignedZones,
          startTime: new Date()
        });

      } else {
        // Dummy mode - create mock data
        vehicle = this.createDummyVehicle({ odooVehicleId: data.odooVehicleId });
        vehicle.trip_id = data.x_studio_trip_id;
        vehicle.trip_details = data;
        vehicle.assignedZones = [{
          parentZoneId: 'dummy_zone',
          geofences: ['dummy_geofence_1'],
          pois: data.odooCustomerIds ? data.odooCustomerIds.map(id => `poi_${id}`) : []
        }];
      }

      // Emit trip assignment event
      if (io) {
        io.emit('trip:assigned', {
          vehicleId: vehicle._id,
          odooVehicleId: vehicle.odooVehicleId,
          tripId: data.x_studio_trip_id,
          zoneId: data.zoneId,
          assignedZones: vehicle.assignedZones,
          customerCount: data.odooCustomerIds?.length || 0,
          totalValue: data.total_value || 0,
          timestamp: new Date()
        });
      }

      return {
        success: true,
        message: 'Trip assigned successfully',
        data: {
          vehicleId: vehicle._id,
          odooVehicleId: vehicle.odooVehicleId,
          tripId: data.x_studio_trip_id,
          assignedZones: vehicle.assignedZones,
          customerCount: data.odooCustomerIds?.length || 0
        }
      };

    } catch (error) {
      console.error('Error assigning trip from Odoo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete a trip
   * Called when trip is completed in Odoo
   */
  async completeTrip(tripId, vehicleId, db, io) {
    try {
      if (db.connected) {
        // Update trip in database
        const trip = await Trip.findOneAndUpdate(
          { trip_id: tripId, vehicleId: vehicleId },
          { completed: true, completedAt: new Date() },
          { new: true }
        );

        if (!trip) {
          throw new Error(`Trip ${tripId} not found for vehicle ${vehicleId}`);
        }

        // Update vehicle - clear trip info
        await Vehicle.findByIdAndUpdate(vehicleId, {
          $unset: { trip_id: 1, trip_details: 1, assignedZones: 1 }
        });

        // Remove from active trips
        this.activeTrips.delete(vehicleId.toString());

        console.log(`Trip ${tripId} completed for vehicle ${vehicleId}`);

        if (io) {
          io.emit('trip:completed', {
            vehicleId,
            tripId,
            completedAt: new Date()
          });
        }

        return {
          success: true,
          message: 'Trip completed successfully'
        };
      } else {
        // Dummy mode
        console.log(`Dummy: Trip ${tripId} completed for vehicle ${vehicleId}`);
        this.activeTrips.delete(vehicleId.toString());
        
        return {
          success: true,
          message: 'Trip completed (dummy mode)'
        };
      }

    } catch (error) {
      console.error('Error completing trip:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get active trip for a vehicle
   */
  async getActiveTrip(vehicleId, db) {
    try {
      if (db.connected) {
        const trip = await Trip.findOne({
          vehicleId: vehicleId,
          completed: false
        }).populate('vehicleId', 'name licensePlate');

        return {
          success: true,
          trip: trip || null
        };
      } else {
        // Dummy mode
        const activeTrip = this.activeTrips.get(vehicleId.toString());
        return {
          success: true,
          trip: activeTrip ? {
            trip_id: activeTrip.odooTripId,
            vehicleId: { name: 'Test Vehicle', licensePlate: 'TEST-001' },
            assignedZones: activeTrip.assignedZones,
            startTime: activeTrip.startTime
          } : null
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all active trips
   */
  async getAllActiveTrips(db) {
    try {
      if (db.connected) {
        const trips = await Trip.find({ completed: false })
          .populate('vehicleId', 'name licensePlate odooVehicleId')
          .sort({ createdAt: -1 });

        return {
          success: true,
          count: trips.length,
          trips
        };
      } else {
        // Dummy mode
        const trips = Array.from(this.activeTrips.values()).map(trip => ({
          trip_id: trip.odooTripId,
          vehicleId: { name: 'Test Vehicle', licensePlate: 'TEST-001' },
          assignedZones: trip.assignedZones,
          startTime: trip.startTime
        }));

        return {
          success: true,
          count: trips.length,
          trips
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create dummy vehicle for testing
   */
  createDummyVehicle(data) {
    return {
      _id: `dummy_${data.odooVehicleId}`,
      odooVehicleId: data.odooVehicleId,
      name: data.name || `Vehicle ${data.odooVehicleId}`,
      licensePlate: data.licensePlate || `PLATE-${data.odooVehicleId}`,
      type: data.type || 'Truck',
      driverName: data.driverName || 'Test Driver',
      driverId: data.driverId || null,
      traccarId: data.traccarId || `traccar_${data.odooVehicleId}`,
      deviceId: data.deviceId || `device_${data.odooVehicleId}`,
      assignedZones: [],
      lastLocation: null
    };
  }
}

// Export singleton instance
const odooService = new OdooService();
module.exports = odooService;