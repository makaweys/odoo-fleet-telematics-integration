const { processLocation } = require('../utils/violationProcessor');
const { checkZones } = require('../utils/zoneChecker');
const { getNormalizedZones } = require('../utils/zoneManager');

class LocationService {
  constructor() {
    this.vehicleZoneStates = new Map(); // Track vehicle's current zones
  }

  /**
   * Process incoming location update
   */
  async processLocationUpdate(data, io, db) {
    try {
      const { device_id, location } = data;
      
      console.log('📍 Location update received:', { 
        device_id, 
        coords: location.coords,
        timestamp: location.timestamp 
      });

      // Get or create vehicle
      let vehicle;
      if (db.connected) {
        const Vehicle = require('../models/Vehicle');
        vehicle = await Vehicle.findOne({ deviceId: device_id });
      } else {
        // Dummy vehicle for testing
        vehicle = this.getDummyVehicle(device_id);
      }

      if (!vehicle) {
        console.warn(`Vehicle not found for device: ${device_id}`);
        return { error: 'Vehicle not found' };
      }

      // Extract coordinates
      const { latitude, longitude, speed, heading, accuracy, altitude } = location.coords;
      const batteryLevel = location.battery?.level ?? null;
      const batteryCharging = location.battery?.is_charging ?? null;
      const odometer = location.odometer ?? null;
      const motion = location.is_moving ?? false;
      const timestamp = location.timestamp ? new Date(location.timestamp) : new Date();

      // Check which zones the vehicle is in
      const currentLocation = { latitude, longitude };
      const currentZones = checkZones(currentLocation);
      const currentZoneIds = currentZones.map(z => z.id);
      
      // Get previous zones
      const prevZoneIds = this.vehicleZoneStates.get(device_id) || [];
      
      // Detect zone changes
      const enteredZones = currentZones.filter(z => !prevZoneIds.includes(z.id));
      const exitedZones = prevZoneIds.filter(id => !currentZoneIds.includes(id));
      
      // Update state
      this.vehicleZoneStates.set(device_id, currentZoneIds);
      
      // Emit live location to all connected clients
      if (io) {
        io.emit('vehicle:location:update', {
          vehicleId: vehicle._id || device_id,
          deviceId: device_id,
          lat: latitude,
          lng: longitude,
          speed,
          heading,
          accuracy,
          altitude,
          batteryLevel,
          batteryCharging,
          odometer,
          motion,
          timestamp,
          currentZones: currentZoneIds,
        });
      }

      // Process violations
      const violationResult = await this.checkViolations(
        vehicle,
        currentLocation,
        currentZoneIds,
        prevZoneIds,
        { speed, altitude, motion, timestamp },
        io,
        db
      );

      // Update vehicle last location
      const updatedVehicle = await this.updateVehicleLocation(
        vehicle,
        {
          latitude,
          longitude,
          speed,
          accuracy,
          altitude,
          odometer,
          motion,
          batteryLevel,
          batteryCharging,
          timestamp,
        },
        violationResult,
        db
      );

      // Save location history if DB connected
      if (db.connected) {
        await this.saveLocationHistory(vehicle, {
          latitude,
          longitude,
          speed,
          accuracy,
          altitude,
          odometer,
          batteryLevel,
          batteryCharging,
          event: violationResult.event,
          timestamp,
        });
      }

      // Emit zone events
      this.emitZoneEvents(enteredZones, exitedZones, vehicle, currentLocation, io, timestamp);

      return {
        success: true,
        vehicle: updatedVehicle,
        violation: violationResult.violation,
        currentZones,
        enteredZones,
        exitedZones,
      };

    } catch (error) {
      console.error('Error processing location:', error);
      return { error: error.message };
    }
  }

  /**
   * Check for zone violations
   */
  async checkViolations(vehicle, location, currentZoneIds, prevZoneIds, telematics, io, db) {
    const result = {
      event: 'in_zone',
      violation: null,
      violatedZones: [],
    };

    // Check if vehicle has assigned zones
    const assignedZones = vehicle.assignedZones || [];
    const hasAssignedZones = assignedZones.length > 0;

    // If vehicle has assigned zones, check if it's in any of them
    if (hasAssignedZones) {
      const assignedZoneIds = assignedZones.flatMap(zone => [
        ...(zone.geofences || []),
        ...(zone.pois || [])
      ].map(id => id.toString ? id.toString() : id));

      const isInAssignedZone = currentZoneIds.some(id => 
        assignedZoneIds.includes(id)
      );

      if (!isInAssignedZone && currentZoneIds.length === 0) {
        // Vehicle is outside all zones (violation)
        result.event = 'violation';
        result.violatedZones = assignedZoneIds;
        
        // Create violation record
        result.violation = await this.createViolation(
          vehicle,
          location,
          telematics,
          'Outside assigned zones',
          assignedZoneIds,
          db
        );

        // Emit violation alert
        if (io) {
          io.emit('violation:alert', {
            vehicleId: vehicle._id || vehicle.deviceId,
            vehicleName: vehicle.name,
            reason: 'Outside assigned zones',
            location,
            timestamp: telematics.timestamp,
            violatedZones: assignedZoneIds,
          });
        }
      }
    } else if (currentZoneIds.length === 0 && prevZoneIds.length > 0) {
      // Vehicle exited all zones (if no specific zones assigned)
      result.event = 'exit';
      
      // Get all zones from zone manager
      const allZones = await getNormalizedZones();
      const exitedZoneDetails = prevZoneIds.map(id => 
        allZones.find(z => z.id === id)
      ).filter(z => z);

      // Emit exit events
      if (io) {
        exitedZoneDetails.forEach(zone => {
          io.emit('zone:exit', {
            vehicleId: vehicle._id || vehicle.deviceId,
            vehicleName: vehicle.name,
            zone,
            location,
            timestamp: telematics.timestamp,
          });
        });
      }
    } else if (currentZoneIds.length > 0 && prevZoneIds.length === 0) {
      // Vehicle entered zones
      result.event = 'entry';
    }

    return result;
  }

  /**
   * Create violation record
   */
  async createViolation(vehicle, location, telematics, reason, violatedZones, db) {
    if (!db.connected) {
      // Return dummy violation in dummy mode
      return {
        _id: `violation_${Date.now()}`,
        vehicleId: vehicle._id || vehicle.deviceId,
        type: 'exit',
        reason,
        violatedZones,
        location,
        timestamp: telematics.timestamp,
      };
    }

    const Violation = require('../models/Violation');
    
    // Check for recent duplicate violations (prevent spam)
    const recentViolation = await Violation.findOne({
      vehicleId: vehicle._id,
      violatedZones: { $all: violatedZones },
      timestamp: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // 10 min cooldown
    });

    if (recentViolation) {
      console.log('Duplicate violation skipped (cooldown)');
      return recentViolation;
    }

    const violation = new Violation({
      vehicleId: vehicle._id,
      type: 'exit',
      reason,
      violatedZones,
      location: { lat: location.latitude, lng: location.longitude },
      speed: telematics.speed,
      altitude: telematics.altitude,
      motion: telematics.motion,
      timestamp: telematics.timestamp,
    });

    await violation.save();
    return violation;
  }

  /**
   * Update vehicle's last location
   */
  async updateVehicleLocation(vehicle, locationData, violationResult, db) {
    const lastLocation = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      speed: locationData.speed,
      accuracy: locationData.accuracy,
      altitude: locationData.altitude,
      odometer: locationData.odometer,
      motion: locationData.motion,
      event: violationResult.event,
      battery: {
        level: locationData.batteryLevel,
        is_charging: locationData.batteryCharging,
      },
      timestamp: locationData.timestamp,
      currentZones: this.vehicleZoneStates.get(vehicle.deviceId) || [],
    };

    if (db.connected) {
      const Vehicle = require('../models/Vehicle');
      vehicle.lastLocation = lastLocation;
      await vehicle.save();
      return vehicle;
    } else {
      // Update dummy vehicle
      vehicle.lastLocation = lastLocation;
      return vehicle;
    }
  }

  /**
   * Save location history
   */
  async saveLocationHistory(vehicle, locationData) {
    try {
      const VehicleLocation = require('../models/VehicleLocation');
      
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
          is_charging: locationData.batteryCharging,
        },
        event: locationData.event,
        timestamp: locationData.timestamp,
      });

      await locationRecord.save();
    } catch (error) {
      console.error('Error saving location history:', error);
    }
  }

  /**
   * Emit zone entry/exit events
   */
  emitZoneEvents(enteredZones, exitedZones, vehicle, location, io, timestamp) {
    if (!io) return;

    // Emit entry events
    enteredZones.forEach(zone => {
      io.emit('zone:entry', {
        vehicleId: vehicle._id || vehicle.deviceId,
        vehicleName: vehicle.name,
        zone,
        location,
        timestamp,
      });
    });

    // Emit exit events
    exitedZones.forEach(zone => {
      io.emit('zone:exit', {
        vehicleId: vehicle._id || vehicle.deviceId,
        vehicleName: vehicle.name,
        zone,
        location,
        timestamp,
      });
    });
  }

  /**
   * Get dummy vehicle for testing
   */
  getDummyVehicle(deviceId) {
    return {
      _id: `dummy_${deviceId}`,
      deviceId,
      name: `Test Vehicle ${deviceId}`,
      licensePlate: `TEST-${deviceId.slice(-4)}`,
      assignedZones: [],
      lastLocation: null,
    };
  }

  /**
   * Get vehicle's current location
   */
  getVehicleLocation(deviceId) {
    const zones = this.vehicleZoneStates.get(deviceId) || [];
    return {
      deviceId,
      currentZones: zones,
      timestamp: new Date(),
    };
  }

  /**
   * Get all active vehicles with locations
   */
  getAllActiveVehicles() {
    const vehicles = [];
    for (const [deviceId, zones] of this.vehicleZoneStates.entries()) {
      vehicles.push({
        deviceId,
        currentZones: zones,
        lastUpdate: new Date(),
      });
    }
    return vehicles;
  }
}

// Singleton instance
const locationService = new LocationService();
module.exports = locationService;