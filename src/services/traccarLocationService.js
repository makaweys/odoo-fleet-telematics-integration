const Vehicle = require('../models/Vehicle');
const VehicleLocation = require('../models/VehicleLocation');
const Violation = require('../models/Violation');
const ZoneEvent = require('../models/ZoneEvent');
const { checkZones } = require('../utils/zoneChecker');
const { getNormalizedZones } = require('../utils/zoneManager');

class TraccarLocationService {
  constructor() {
    // Store last known zones per vehicle to detect changes
    this.vehicleZoneState = new Map();
    // Store last violation timestamp per vehicle to prevent spam
    this.lastViolationTime = new Map();
  }

  /**
   * Process Traccar location update
   * This handles the exact format sent by Traccar mobile app
   */
  async processTraccarLocation(data, io, db) {
    try {
      console.log('Processing Traccar location update:', {
        device_id: data.device_id,
        timestamp: data.location?.timestamp
      });

      // Validate required fields
      if (!data.device_id || !data.location) {
        throw new Error('device_id and location are required');
      }

      const { device_id, location } = data;
      
      // Validate coordinates
      if (!location.coords || location.coords.latitude == null || location.coords.longitude == null) {
        throw new Error('Valid coordinates are required');
      }

      // Extract and normalize data
      const normalizedData = this.normalizeTraccarData(data);
      
      // Find vehicle by traccarId (device_id)
      let vehicle;
      if (db.connected) {
        vehicle = await Vehicle.findOne({ 
          $or: [
            { traccarId: device_id },
            { deviceId: device_id }
          ]
        })
        .populate('assignedZones.parentZoneId', 'name')
        .populate('assignedZones.geofences', 'name path')
        .populate('assignedZones.pois', 'name location radius');
      } else {
        // Dummy vehicle for testing
        vehicle = this.createDummyVehicle(device_id);
      }

      if (!vehicle) {
        console.log(`Vehicle not found for Traccar ID: ${device_id}`);
        return { 
          success: false, 
          error: 'Vehicle not registered',
          device_id 
        };
      }

      // Process the location
      const result = await this.processVehicleLocation(
        vehicle,
        normalizedData,
        io,
        db
      );

      // Broadcast real-time update via WebSocket
      if (io && result.processed) {
        this.broadcastLocationUpdate(io, vehicle, normalizedData, result);
      }

      return {
        success: true,
        processed: result.processed,
        violation: result.violation,
        zoneEvents: result.zoneEvents,
        vehicleId: vehicle._id,
        device_id
      };

    } catch (error) {
      console.error('Error processing Traccar location:', error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  /**
   * Normalize Traccar data format to our internal format
   */
  normalizeTraccarData(data) {
    const { device_id, location } = data;
    
    return {
      deviceId: device_id,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: location.coords.speed || 0,
      heading: location.coords.heading || 0,
      accuracy: location.coords.accuracy || 0,
      altitude: location.coords.altitude || 0,
      batteryLevel: location.battery?.level || null,
      batteryCharging: location.battery?.is_charging || false,
      odometer: location.odometer || 0,
      motion: location.is_moving || false,
      timestamp: location.timestamp ? new Date(location.timestamp) : new Date(),
      rawData: data // Keep original for debugging
    };
  }

  /**
   * Process vehicle location with zone checking
   */
  async processVehicleLocation(vehicle, locationData, io, db) {
    const result = {
      processed: false,
      violation: null,
      zoneEvents: [],
      currentZones: [],
      previousZones: []
    };

    try {
      // Get current and previous zones
      const previousZoneIds = this.vehicleZoneState.get(vehicle._id.toString()) || [];
      result.previousZones = previousZoneIds;

      // Check which zones the vehicle is currently in
      const currentLocation = {
        latitude: locationData.latitude,
        longitude: locationData.longitude
      };

      const zonesIn = checkZones(currentLocation);
      const currentZoneIds = zonesIn.map(z => z.id);
      result.currentZones = currentZoneIds;

      // Update zone state
      this.vehicleZoneState.set(vehicle._id.toString(), currentZoneIds);

      // Detect zone changes
      const zoneEvents = this.detectZoneChanges(
        previousZoneIds,
        currentZoneIds,
        vehicle,
        locationData
      );

      if (zoneEvents.length > 0) {
        result.zoneEvents = zoneEvents;
        
        // Save zone events if DB is connected
        if (db.connected) {
          await this.saveZoneEvents(zoneEvents, db);
        }

        // Broadcast zone events
        if (io) {
          this.broadcastZoneEvents(io, zoneEvents, vehicle);
        }
      }

      // Check for violations
      const violation = await this.checkForViolations(
        vehicle,
        currentZoneIds,
        locationData,
        io,
        db
      );

      if (violation) {
        result.violation = violation;
      }

      // Update vehicle's last location
      await this.updateVehicleLastLocation(vehicle, locationData, currentZoneIds, db);

      // Save location history if DB is connected
      if (db.connected) {
        await this.saveLocationHistory(vehicle, locationData, currentZoneIds, db);
      }

      result.processed = true;

    } catch (error) {
      console.error('Error in processVehicleLocation:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Detect zone entry/exit events
   */
  detectZoneChanges(previousZoneIds, currentZoneIds, vehicle, locationData) {
    const events = [];
    const allZones = getNormalizedZones();

    // Find zones that were entered
    const enteredZoneIds = currentZoneIds.filter(id => !previousZoneIds.includes(id));
    const exitedZoneIds = previousZoneIds.filter(id => !currentZoneIds.includes(id));

    // Create entry events
    enteredZoneIds.forEach(zoneId => {
      const zone = allZones.find(z => z.id === zoneId);
      if (zone) {
        events.push({
          type: 'entry',
          zoneId: zone.id,
          zoneName: zone.name,
          zoneType: zone.type,
          vehicleId: vehicle._id,
          vehicleName: vehicle.name,
          location: {
            latitude: locationData.latitude,
            longitude: locationData.longitude
          },
          timestamp: locationData.timestamp
        });
      }
    });

    // Create exit events
    exitedZoneIds.forEach(zoneId => {
      const zone = allZones.find(z => z.id === zoneId);
      if (zone) {
        events.push({
          type: 'exit',
          zoneId: zone.id,
          zoneName: zone.name,
          zoneType: zone.type,
          vehicleId: vehicle._id,
          vehicleName: vehicle.name,
          location: {
            latitude: locationData.latitude,
            longitude: locationData.longitude
          },
          timestamp: locationData.timestamp
        });
      }
    });

    return events;
  }

  /**
   * Check for zone violations
   */
  async checkForViolations(vehicle, currentZoneIds, locationData, io, db) {
    // If vehicle has no assigned zones, no violations to check
    if (!vehicle.assignedZones || vehicle.assignedZones.length === 0) {
      return null;
    }

    // Get all assigned zone IDs (geofences + POIs)
    const assignedZoneIds = this.getAssignedZoneIds(vehicle);
    
    // Check if vehicle is in at least one assigned zone
    const isInAssignedZone = currentZoneIds.some(zoneId => 
      assignedZoneIds.includes(zoneId)
    );

    // If not in any assigned zone, it's a violation
    if (!isInAssignedZone && assignedZoneIds.length > 0) {
      // Check cooldown to prevent spam
      const lastViolation = this.lastViolationTime.get(vehicle._id.toString());
      const now = Date.now();
      const cooldownMs = 10 * 60 * 1000; // 10 minutes

      if (lastViolation && (now - lastViolation) < cooldownMs) {
        console.log(`Violation cooldown active for vehicle ${vehicle._id}`);
        return null;
      }

      // Create violation
      const violation = {
        vehicleId: vehicle._id,
        type: 'zone_violation',
        reason: 'Outside assigned zones',
        violatedZones: assignedZoneIds,
        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        },
        speed: locationData.speed,
        altitude: locationData.altitude,
        motion: locationData.motion,
        timestamp: locationData.timestamp
      };

      // Update last violation time
      this.lastViolationTime.set(vehicle._id.toString(), now);

      // Save violation if DB is connected
      if (db.connected) {
        try {
          const violationDoc = new Violation(violation);
          await violationDoc.save();
          violation._id = violationDoc._id;
        } catch (error) {
          console.error('Error saving violation:', error);
        }
      }

      // Broadcast violation
      if (io) {
        io.emit('violation:detected', {
          ...violation,
          vehicleName: vehicle.name,
          vehicleLicensePlate: vehicle.licensePlate
        });
      }

      return violation;
    }

    return null;
  }

  /**
   * Get all assigned zone IDs for a vehicle
   */
  getAssignedZoneIds(vehicle) {
    const zoneIds = [];
    
    if (!vehicle.assignedZones) {
      return zoneIds;
    }

    vehicle.assignedZones.forEach(zoneAssignment => {
      // Add geofence IDs
      if (zoneAssignment.geofences && Array.isArray(zoneAssignment.geofences)) {
        zoneAssignment.geofences.forEach(gf => {
          const id = gf._id ? gf._id.toString() : gf;
          zoneIds.push(id);
        });
      }

      // Add POI IDs
      if (zoneAssignment.pois && Array.isArray(zoneAssignment.pois)) {
        zoneAssignment.pois.forEach(poi => {
          const id = poi._id ? poi._id.toString() : poi;
          zoneIds.push(id);
        });
      }
    });

    return [...new Set(zoneIds)]; // Remove duplicates
  }

  /**
   * Update vehicle's last location
   */
  async updateVehicleLastLocation(vehicle, locationData, currentZoneIds, db) {
    if (!db.connected) {
      // Update dummy vehicle
      vehicle.lastLocation = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        speed: locationData.speed,
        accuracy: locationData.accuracy,
        altitude: locationData.altitude,
        odometer: locationData.odometer,
        motion: locationData.motion,
        battery: {
          level: locationData.batteryLevel,
          is_charging: locationData.batteryCharging
        },
        timestamp: locationData.timestamp,
        currentZones: currentZoneIds
      };
      return;
    }

    // Update real vehicle in database
    vehicle.lastLocation = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      speed: locationData.speed,
      accuracy: locationData.accuracy,
      altitude: locationData.altitude,
      odometer: locationData.odometer,
      motion: locationData.motion,
      event: currentZoneIds.length > 0 ? 'in_zone' : 'outside_zones',
      battery: {
        level: locationData.batteryLevel,
        is_charging: locationData.batteryCharging
      },
      timestamp: locationData.timestamp,
      currentZones: currentZoneIds
    };

    await vehicle.save();
  }

  /**
   * Save location history
   */
  async saveLocationHistory(vehicle, locationData, currentZoneIds, db) {
    if (!db.connected) return;

    try {
      const locationRecord = new VehicleLocation({
        vehicle: vehicle._id,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        speed: locationData.speed,
        accuracy: locationData.accuracy,
        altitude: locationData.altitude,
        odometer: locationData.odometer,
        battery: {
          level: locationData.batteryLevel,
          is_charging: locationData.batteryCharging
        },
        event: currentZoneIds.length > 0 ? 'in_zone' : 'outside_zones',
        timestamp: locationData.timestamp
      });

      await locationRecord.save();
    } catch (error) {
      console.error('Error saving location history:', error);
    }
  }

  /**
   * Save zone events to database
   */
  async saveZoneEvents(zoneEvents, db) {
    if (!db.connected || !zoneEvents.length) return;

    try {
      const eventsToSave = zoneEvents.map(event => ({
        vehicleId: event.vehicleId,
        zoneId: event.zoneId,
        zoneName: event.zoneName,
        zoneType: event.zoneType,
        event: event.type,
        location: event.location,
        timestamp: event.timestamp
      }));

      await ZoneEvent.insertMany(eventsToSave);
    } catch (error) {
      console.error('Error saving zone events:', error);
    }
  }

  /**
   * Broadcast location update via WebSocket
   */
  broadcastLocationUpdate(io, vehicle, locationData, result) {
    io.emit('vehicle:location:update', {
      vehicleId: vehicle._id,
      deviceId: vehicle.deviceId || vehicle.traccarId,
      vehicleName: vehicle.name,
      licensePlate: vehicle.licensePlate,
      lat: locationData.latitude,
      lng: locationData.longitude,
      speed: locationData.speed,
      heading: locationData.heading,
      accuracy: locationData.accuracy,
      altitude: locationData.altitude,
      batteryLevel: locationData.batteryLevel,
      batteryCharging: locationData.batteryCharging,
      motion: locationData.motion,
      timestamp: locationData.timestamp,
      currentZones: result.currentZones,
      violation: result.violation ? true : false
    });
  }

  /**
   * Broadcast zone events via WebSocket
   */
  broadcastZoneEvents(io, zoneEvents, vehicle) {
    zoneEvents.forEach(event => {
      io.emit('zone:event', {
        ...event,
        vehicleName: vehicle.name,
        licensePlate: vehicle.licensePlate
      });
    });
  }

  /**
   * Create dummy vehicle for testing
   */
  createDummyVehicle(deviceId) {
    return {
      _id: `dummy_${deviceId}`,
      traccarId: deviceId,
      deviceId: deviceId,
      name: `Test Vehicle ${deviceId.substring(0, 8)}`,
      licensePlate: `TEST-${deviceId.substring(0, 4)}`,
      assignedZones: [],
      lastLocation: null
    };
  }

  /**
   * Get vehicle's current zone state
   */
  getVehicleZoneState(vehicleId) {
    return this.vehicleZoneState.get(vehicleId.toString()) || [];
  }

  /**
   * Get all vehicles with their current zones
   */
  getAllVehicleStates() {
    const states = [];
    for (const [vehicleId, zones] of this.vehicleZoneState.entries()) {
      states.push({
        vehicleId,
        zones,
        lastUpdate: new Date()
      });
    }
    return states;
  }
}

// Export singleton instance
const traccarLocationService = new TraccarLocationService();
module.exports = traccarLocationService;