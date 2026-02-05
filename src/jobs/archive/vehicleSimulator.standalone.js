// jobs/vehicleSimulator.js - Vehicle telematics simulator
const { getIO } = require('../../lib/socket');
const { getZones, checkLocation } = require('../../utils/zoneManager');

// Simulated vehicle database
const simulatedVehicles = [
  {
    id: 'vehicle_001',
    name: 'Toyota Hilux - KCA 123A',
    deviceId: 'dev_001',
    deviceToken: 'sim_token_001',
    type: 'pickup',
    status: 'moving',
    driver: 'John Kamau',
    company: 'Nairobi Logistics',
    color: '#3498db',
    icon: '🚚',
    currentLocation: {
      lat: -1.2921,
      lng: 36.8219,
      speed: 60,
      heading: 45,
      accuracy: 15,
      timestamp: new Date()
    },
    route: [
      { lat: -1.2921, lng: 36.8219 }, // Nairobi CBD
      { lat: -1.2800, lng: 36.8300 }, // Upper Hill
      { lat: -1.3100, lng: 36.8100 }, // Industrial Area
      { lat: -1.3200, lng: 36.8200 }, // South B
      { lat: -1.3000, lng: 36.8400 }  // Westlands
    ],
    routeIndex: 0,
    speedRange: { min: 20, max: 80 }, // km/h
    violationChance: 0.1, // 10% chance of violation
    lastViolation: null,
    isOnline: true
  },
  {
    id: 'vehicle_002',
    name: 'Isuzu Truck - KCB 456B',
    deviceId: 'dev_002',
    deviceToken: 'sim_token_002',
    type: 'truck',
    status: 'idle',
    driver: 'Peter Omondi',
    company: 'Mombasa Hauliers',
    color: '#e74c3c',
    icon: '🚛',
    currentLocation: {
      lat: -1.3100,
      lng: 36.8100,
      speed: 0,
      heading: 0,
      accuracy: 10,
      timestamp: new Date()
    },
    route: [
      { lat: -1.3100, lng: 36.8100 }, // Industrial Area
      { lat: -1.3200, lng: 36.8200 }, // South B
      { lat: -1.3000, lng: 36.8400 }, // Westlands
      { lat: -1.2921, lng: 36.8219 }  // Nairobi CBD
    ],
    routeIndex: 0,
    speedRange: { min: 30, max: 100 },
    violationChance: 0.15,
    lastViolation: null,
    isOnline: true
  },
  {
    id: 'vehicle_003',
    name: 'Mercedes Sprinter - KCD 789C',
    deviceId: 'dev_003',
    deviceToken: 'sim_token_003',
    type: 'van',
    status: 'moving',
    driver: 'Sarah Wanjiku',
    company: 'Express Couriers',
    color: '#2ecc71',
    icon: '🚐',
    currentLocation: {
      lat: -1.2800,
      lng: 36.8300,
      speed: 45,
      heading: 90,
      accuracy: 20,
      timestamp: new Date()
    },
    route: [
      { lat: -1.2800, lng: 36.8300 }, // Upper Hill
      { lat: -1.3000, lng: 36.8400 }, // Westlands
      { lat: -1.2921, lng: 36.8219 }, // Nairobi CBD
      { lat: -1.3100, lng: 36.8100 }  // Industrial Area
    ],
    routeIndex: 0,
    speedRange: { min: 25, max: 70 },
    violationChance: 0.08,
    lastViolation: null,
    isOnline: true
  },
  {
    id: 'vehicle_004',
    name: 'Nissan Patrol - KCE 012D',
    deviceId: 'dev_004',
    deviceToken: 'sim_token_004',
    type: 'suv',
    status: 'stopped',
    driver: 'David Njoroge',
    company: 'Executive Transport',
    color: '#f39c12',
    icon: '🚙',
    currentLocation: {
      lat: -1.3000,
      lng: 36.8400,
      speed: 0,
      heading: 180,
      accuracy: 5,
      timestamp: new Date()
    },
    route: [
      { lat: -1.3000, lng: 36.8400 }, // Westlands
      { lat: -1.2921, lng: 36.8219 }, // Nairobi CBD
      { lat: -1.2800, lng: 36.8300 }, // Upper Hill
      { lat: -1.3100, lng: 36.8100 }  // Industrial Area
    ],
    routeIndex: 0,
    speedRange: { min: 15, max: 120 },
    violationChance: 0.2,
    lastViolation: null,
    isOnline: false // Offline vehicle
  }
];

// Violation types with thresholds
const VIOLATION_TYPES = {
  SPEEDING: {
    type: 'speeding',
    threshold: 80, // km/h
    severity: 'medium'
  },
  IDLING: {
    type: 'idling',
    threshold: 300, // seconds
    severity: 'low'
  },
  HARD_BRAKE: {
    type: 'hard_brake',
    threshold: 0.4, // g-force
    severity: 'high'
  },
  RAPID_ACCELERATION: {
    type: 'rapid_acceleration',
    threshold: 0.3, // g-force
    severity: 'medium'
  },
  GEO_BOUNDARY: {
    type: 'geofence_violation',
    severity: 'high'
  }
};

class VehicleSimulator {
  constructor(io) {
    this.io = io;
    this.simulatedVehicles = [...simulatedVehicles];
    this.simulationInterval = null;
    this.updateInterval = 3000; // Update every 3 seconds
    this.violationLog = [];
    this.locationHistory = new Map(); // Store recent locations per vehicle
    
    console.log('Vehicle Simulator initialized with', this.simulatedVehicles.length, 'vehicles');
  }

  /**
   * Start the vehicle simulation
   */
  start() {
    if (this.simulationInterval) {
      console.log('Simulation already running');
      return;
    }

    console.log('Starting vehicle simulation...');
    
    // Initial vehicle status broadcast
    this.broadcastVehicleStatus();
    
    // Start simulation interval
    this.simulationInterval = setInterval(() => {
      this.updateVehiclePositions();
      this.checkForViolations();
      this.broadcastVehicleLocations();
    }, this.updateInterval);

    // Periodic status updates
    setInterval(() => {
      this.broadcastVehicleStatus();
      this.updateRandomVehicleStatus();
    }, 10000); // Every 10 seconds

    console.log(`Vehicle simulation started (${this.updateInterval}ms updates)`);
  }

  /**
   * Stop the simulation
   */
  stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      console.log('Vehicle simulation stopped');
    }
  }

  /**
   * Update vehicle positions along their routes
   */
  updateVehiclePositions() {
    this.simulatedVehicles.forEach(vehicle => {
      if (!vehicle.isOnline) return;

      // Get current route point
      const currentPoint = vehicle.route[vehicle.routeIndex];
      const nextIndex = (vehicle.routeIndex + 1) % vehicle.route.length;
      const nextPoint = vehicle.route[nextIndex];

      // Calculate distance between points
      const distance = this.calculateDistance(
        currentPoint.lat, currentPoint.lng,
        nextPoint.lat, nextPoint.lng
      );

      // Move vehicle (simplified linear movement)
      const progress = 0.1; // Move 10% of distance each update
      
      // Update location
      vehicle.currentLocation.lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * progress;
      vehicle.currentLocation.lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * progress;
      
      // Update heading
      vehicle.currentLocation.heading = this.calculateBearing(
        currentPoint.lat, currentPoint.lng,
        nextPoint.lat, nextPoint.lng
      );

      // Update speed (random within range)
      vehicle.currentLocation.speed = this.getRandomSpeed(vehicle.speedRange);
      vehicle.currentLocation.timestamp = new Date();

      // Move to next point if close enough
      if (this.calculateDistance(
        vehicle.currentLocation.lat, vehicle.currentLocation.lng,
        nextPoint.lat, nextPoint.lng
      ) < 0.01) { // ~1km threshold
        vehicle.routeIndex = nextIndex;
      }

      // Check zone boundaries
      this.checkZoneBoundaries(vehicle);

      // Store location history
      if (!this.locationHistory.has(vehicle.id)) {
        this.locationHistory.set(vehicle.id, []);
      }
      
      const history = this.locationHistory.get(vehicle.id);
      history.push({
        lat: vehicle.currentLocation.lat,
        lng: vehicle.currentLocation.lng,
        timestamp: new Date(),
        speed: vehicle.currentLocation.speed
      });

      // Keep only last 50 locations
      if (history.length > 50) {
        history.shift();
      }
    });
  }

  /**
   * Check for driving violations
   */
  checkForViolations() {
    this.simulatedVehicles.forEach(vehicle => {
      if (!vehicle.isOnline || vehicle.status === 'idle') return;

      // Check for speeding
      if (vehicle.currentLocation.speed > VIOLATION_TYPES.SPEEDING.threshold) {
        this.triggerViolation(vehicle, VIOLATION_TYPES.SPEEDING, {
          speed: vehicle.currentLocation.speed,
          limit: VIOLATION_TYPES.SPEEDING.threshold
        });
      }

      // Random violation chance
      if (Math.random() < vehicle.violationChance) {
        const violationTypes = Object.keys(VIOLATION_TYPES);
        const randomType = violationTypes[Math.floor(Math.random() * violationTypes.length)];
        
        if (randomType !== 'SPEEDING') { // Already checked speeding
          this.triggerViolation(vehicle, VIOLATION_TYPES[randomType], {
            location: { ...vehicle.currentLocation },
            vehicle: vehicle.name
          });
        }
      }

      // Check for idling (if speed is 0 for too long)
      if (vehicle.currentLocation.speed === 0 && vehicle.status === 'moving') {
        vehicle.idleStart = vehicle.idleStart || new Date();
        const idleSeconds = (new Date() - vehicle.idleStart) / 1000;
        
        if (idleSeconds > VIOLATION_TYPES.IDLING.threshold) {
          this.triggerViolation(vehicle, VIOLATION_TYPES.IDLING, {
            duration: Math.round(idleSeconds),
            location: { ...vehicle.currentLocation }
          });
          vehicle.idleStart = null;
        }
      } else {
        vehicle.idleStart = null;
      }
    });
  }

  /**
   * Check if vehicle enters/exits zones
   */
  checkZoneBoundaries(vehicle) {
    try {
      const zones = getZones();
      const currentLocation = vehicle.currentLocation;
      
      if (!zones || !currentLocation) return;

      // Check against all geofences and POIs
      const locationCheck = checkLocation(
        currentLocation.lat,
        currentLocation.lng
      );

      // Emit geofence events
      if (locationCheck.geofences.length > 0) {
        const geofence = locationCheck.geofences[0];
        
        // Only emit if this is a new geofence (not the last one)
        if (!vehicle.lastGeofence || vehicle.lastGeofence.id !== geofence.id) {
          this.emitGeofenceEvent(vehicle, 'enter', geofence);
          vehicle.lastGeofence = geofence;
        }
      } else if (vehicle.lastGeofence) {
        // Exited geofence
        this.emitGeofenceEvent(vehicle, 'exit', vehicle.lastGeofence);
        vehicle.lastGeofence = null;
      }
    } catch (error) {
      console.error('Error checking zone boundaries:', error);
    }
  }

  /**
   * Trigger a violation event
   */
  triggerViolation(vehicle, violationType, details) {
    // Don't trigger same violation too frequently
    const now = new Date();
    if (vehicle.lastViolation && 
        (now - vehicle.lastViolation) < 30000) { // 30 seconds cooldown
      return;
    }

    const violation = {
      id: `viol_${Date.now()}_${vehicle.id}`,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      deviceId: vehicle.deviceId,
      type: violationType.type,
      severity: violationType.severity,
      details: details,
      location: { ...vehicle.currentLocation },
      timestamp: new Date(),
      acknowledged: false,
      driver: vehicle.driver,
      company: vehicle.company
    };

    // Add to log
    this.violationLog.push(violation);
    if (this.violationLog.length > 100) {
      this.violationLog.shift();
    }

    // Emit via socket
    if (this.io) {
      this.io.emit('violation:alert', violation);
      this.io.to('admin:room').emit('violation:detected', violation);
      
      console.log(`Violation: ${vehicle.name} - ${violationType.type} (${violationType.severity})`);
    }

    vehicle.lastViolation = now;
    return violation;
  }

  /**
   * Emit geofence event
   */
  emitGeofenceEvent(vehicle, eventType, geofence) {
    const event = {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      eventType: eventType, // 'enter' or 'exit'
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      location: { ...vehicle.currentLocation },
      timestamp: new Date()
    };

    if (this.io) {
      this.io.emit('geofence:event', event);
      this.io.to('admin:room').emit('geofence:activity', event);
      
      console.log(`${vehicle.name} ${eventType}ed ${geofence.name}`);
    }

    return event;
  }

  /**
   * Broadcast vehicle locations
   */
  broadcastVehicleLocations() {
    if (!this.io) return;

    this.simulatedVehicles.forEach(vehicle => {
      if (!vehicle.isOnline) return;

      const locationData = {
        vehicleId: vehicle.id,
        deviceId: vehicle.deviceId,
        latitude: vehicle.currentLocation.lat,
        longitude: vehicle.currentLocation.lng,
        speed: vehicle.currentLocation.speed,
        heading: vehicle.currentLocation.heading,
        accuracy: vehicle.currentLocation.accuracy,
        timestamp: vehicle.currentLocation.timestamp,
        vehicleName: vehicle.name,
        status: vehicle.status,
        driver: vehicle.driver
      };

      // Emit to vehicle-specific room
      this.io.to(`vehicle:${vehicle.id}`).emit('vehicle:location', locationData);
      
      // Also emit to all for map updates
      this.io.emit('simulation:vehicle:location', locationData);
    });
  }

  /**
   * Broadcast vehicle status
   */
  broadcastVehicleStatus() {
    if (!this.io) return;

    const statusUpdates = this.simulatedVehicles.map(vehicle => ({
      vehicleId: vehicle.id,
      deviceId: vehicle.deviceId,
      status: vehicle.status,
      isOnline: vehicle.isOnline,
      lastSeen: vehicle.currentLocation.timestamp,
      location: {
        lat: vehicle.currentLocation.lat,
        lng: vehicle.currentLocation.lng
      },
      driver: vehicle.driver,
      vehicleName: vehicle.name
    }));

    this.io.emit('vehicle:status:update', statusUpdates);
  }

  /**
   * Randomly update vehicle status (online/offline, moving/idle)
   */
  updateRandomVehicleStatus() {
    this.simulatedVehicles.forEach(vehicle => {
      // 5% chance to toggle online status
      if (Math.random() < 0.05) {
        vehicle.isOnline = !vehicle.isOnline;
        console.log(`${vehicle.name} is now ${vehicle.isOnline ? 'online' : 'offline'}`);
      }

      // 10% chance to change status
      if (vehicle.isOnline && Math.random() < 0.1) {
        const statuses = ['moving', 'idle', 'stopped'];
        const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        if (newStatus !== vehicle.status) {
          vehicle.status = newStatus;
          console.log(`${vehicle.name} status changed to ${newStatus}`);
        }
      }
    });
  }

  /**
   * Get simulated vehicle data
   */
  getSimulatedVehicles() {
    return this.simulatedVehicles.map(vehicle => ({
      ...vehicle,
      currentLocation: { ...vehicle.currentLocation }
    }));
  }

  /**
   * Get violation log
   */
  getViolationLog(limit = 50) {
    return this.violationLog.slice(-limit);
  }

  /**
   * Get vehicle location history
   */
  getVehicleHistory(vehicleId, limit = 20) {
    const history = this.locationHistory.get(vehicleId) || [];
    return history.slice(-limit);
  }

  /**
   * Control specific vehicle
   */
  controlVehicle(vehicleId, command) {
    const vehicle = this.simulatedVehicles.find(v => v.id === vehicleId);
    if (!vehicle) return { success: false, error: 'Vehicle not found' };

    switch (command.action) {
      case 'toggle_online':
        vehicle.isOnline = !vehicle.isOnline;
        return { success: true, isOnline: vehicle.isOnline };
      
      case 'set_status':
        vehicle.status = command.status;
        return { success: true, status: vehicle.status };
      
      case 'set_location':
        vehicle.currentLocation.lat = command.lat;
        vehicle.currentLocation.lng = command.lng;
        return { success: true, location: vehicle.currentLocation };
      
      default:
        return { success: false, error: 'Unknown command' };
    }
  }

  // Helper methods
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  getRandomSpeed(range) {
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }
}

// Singleton instance
let simulatorInstance = null;

/**
 * Start the vehicle simulator
 */
function startSimulator(io) {
  if (!simulatorInstance) {
    simulatorInstance = new VehicleSimulator(io);
  }
  
  simulatorInstance.start();
  return simulatorInstance;
}

/**
 * Stop the vehicle simulator
 */
function stopSimulator() {
  if (simulatorInstance) {
    simulatorInstance.stop();
  }
}

/**
 * Get simulator instance
 */
function getSimulator() {
  return simulatorInstance;
}

module.exports = {
  VehicleSimulator,
  startSimulator,
  stopSimulator,
  getSimulator
};