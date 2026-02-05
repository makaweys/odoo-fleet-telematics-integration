// jobs/vehicleSimulator.js - Traccar-compatible vehicle simulator
const axios = require('axios');
const { getIO } = require('../lib/socket');

// Traccar-compatible polygon area (your existing polygon)
const OPERATIONAL_POLYGON = [
  { lat: -1.3346821666837316, lng: 36.88196395501709 },
  { lat: -1.3382002676478242, lng: 36.88393806085205 },
  { lat: -1.3439708003694144, lng: 36.88430284127808 },
  { lat: -1.3420186885927174, lng: 36.87798355683899 },
  { lat: -1.3389403553184016, lng: 36.87477027043915 },
  { lat: -1.3404848853892741, lng: 36.87322800025559 },
  { lat: -1.3390047107574592, lng: 36.87134106621361 },
  { lat: -1.339798427700214, lng: 36.8684664087019 },
  { lat: -1.335207736964936, lng: 36.861020931752684 },
  { lat: -1.327377476978553, lng: 36.846868108033874 },
  { lat: -1.3283805156469952, lng: 36.83987918345725 },
  { lat: -1.329796340994024, lng: 36.83187861002389 },
  { lat: -1.3320853340100274, lng: 36.8261075688404 },
  { lat: -1.3327567004578709, lng: 36.8217741518976 },
  { lat: -1.3328425079255344, lng: 36.80926484546482 },
  { lat: -1.3253772470747456, lng: 36.79477044615467 },
  { lat: -1.3209448187339834, lng: 36.76280400821831 },
  { lat: -1.31237880481357, lng: 36.730684619816536 },
  { lat: -1.2713695594246877, lng: 36.66226820564494 },
  { lat: -1.376373360953581, lng: 36.857227936791574 },
  { lat: -1.2787367188520982, lng: 36.7322584543697 },
  { lat: -1.2954694801497968, lng: 36.7068096552364 },
  { lat: -1.2873176357976113, lng: 36.70854772667805 },
  { lat: -1.2805816184227308, lng: 36.709105626153146 },
  { lat: -1.26516875456464, lng: 36.72209451858596 },
  { lat: -1.2628121674683257, lng: 36.76553793077569 },
  { lat: -1.2640383947476468, lng: 36.73351304166327 },
  { lat: -1.2641242045479923, lng: 36.73128144376288 },
  { lat: -1.2592330414085633, lng: 36.706476374793155 },
  { lat: -1.2600177758383282, lng: 36.72042888282593 },
  { lat: -1.263621790588101, lng: 36.76038306831177 },
  { lat: -1.2640937445305866, lng: 36.74905341743286 }
];

// Simulated vehicles that mimic real devices
const SIMULATED_VEHICLES = [
  {
    _id: '65f8a1b2c8d9e8f7a6b5c4d1',
    deviceId: 'T001',
    deviceToken: 'device_token_001',
    name: 'Toyota Hilux - KCA 123A',
    plateNumber: 'KCA 123A',
    type: 'pickup',
    driver: {
      name: 'John Kamau',
      phone: '+254712345678'
    },
    company: 'Nairobi Logistics Ltd',
    status: 'active',
    currentLocation: {
      lat: -1.2921,
      lng: 36.8219,
      speed: 0,
      heading: 0,
      accuracy: 15,
      timestamp: new Date()
    }
  },
  {
    _id: '65f8a1b2c8d9e8f7a6b5c4d2',
    deviceId: 'T002',
    deviceToken: 'device_token_002',
    name: 'Isuzu Truck - KCB 456B',
    plateNumber: 'KCB 456B',
    type: 'truck',
    driver: {
      name: 'Peter Omondi',
      phone: '+254723456789'
    },
    company: 'Mombasa Hauliers',
    status: 'active',
    currentLocation: {
      lat: -1.3100,
      lng: 36.8100,
      speed: 0,
      heading: 0,
      accuracy: 10,
      timestamp: new Date()
    }
  },
  {
    _id: '65f8a1b2c8d9e8f7a6b5c4d3',
    deviceId: 'T003',
    deviceToken: 'device_token_003',
    name: 'Mercedes Sprinter - KCD 789C',
    plateNumber: 'KCD 789C',
    type: 'van',
    driver: {
      name: 'Sarah Wanjiku',
      phone: '+254734567890'
    },
    company: 'Express Couriers',
    status: 'active',
    currentLocation: {
      lat: -1.2800,
      lng: 36.8300,
      speed: 0,
      heading: 0,
      accuracy: 20,
      timestamp: new Date()
    }
  },
  {
    _id: '65f8a1b2c8d9e8f7a6b5c4d4',
    deviceId: 'T004',
    deviceToken: 'device_token_004',
    name: 'Nissan Patrol - KCE 012D',
    plateNumber: 'KCE 012D',
    type: 'suv',
    driver: {
      name: 'David Njoroge',
      phone: '+254745678901'
    },
    company: 'Executive Transport',
    status: 'inactive',
    currentLocation: {
      lat: -1.3000,
      lng: 36.8400,
      speed: 0,
      heading: 0,
      accuracy: 5,
      timestamp: new Date()
    }
  }
];

// Helper functions
function getBoundingBox(polygon) {
  const lats = polygon.map(p => p.lat);
  const lngs = polygon.map(p => p.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs)
  };
}

function isPointInPolygon(point, polygon) {
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00000001) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

function generateRandomPointInsidePolygon(polygon) {
  const bounds = getBoundingBox(polygon);
  let point;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    point = {
      lat: Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat,
      lng: Math.random() * (bounds.maxLng - bounds.minLng) + bounds.minLng
    };
    attempts++;
    
    // Fallback to polygon vertex if too many attempts
    if (attempts > maxAttempts) {
      const index = Math.floor(Math.random() * polygon.length);
      point = { ...polygon[index] };
      break;
    }
  } while (!isPointInPolygon(point, polygon));
  
  return point;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

class TraccarSimulator {
  constructor(io) {
    this.io = io;
    this.simulatedVehicles = [...SIMULATED_VEHICLES];
    this.simulationInterval = null;
    this.updateInterval = 30000; // 30 seconds (typical GPS update interval)
    this.serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    this.isRunning = false;
    
    console.log('Traccar Simulator initialized with ' + this.simulatedVehicles.length + ' vehicles');
  }

  /**
   * Start the simulation
   */
  start() {
    if (this.isRunning) {
      console.log('Simulation already running');
      return;
    }

    console.log('Starting Traccar-compatible vehicle simulation...');
    console.log('Sending updates to: ' + this.serverUrl);
    console.log('Update interval: ' + this.updateInterval / 1000 + ' seconds');
    
    this.isRunning = true;
    
    // Initial location updates
    this.sendAllLocationUpdates();
    
    // Start periodic updates
    this.simulationInterval = setInterval(() => {
      this.sendAllLocationUpdates();
    }, this.updateInterval);
    
    // Random status changes
    setInterval(() => {
      this.updateRandomVehicleStatus();
    }, 60000);
    
    console.log('Traccar simulation started');
  }

  /**
   * Stop the simulation
   */
  stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    this.isRunning = false;
    console.log('Traccar simulation stopped');
  }

  /**
   * Send location updates for all vehicles
   */
  async sendAllLocationUpdates() {
    const promises = this.simulatedVehicles
      .filter(vehicle => vehicle.status === 'active')
      .map(vehicle => this.sendVehicleLocation(vehicle));
    
    await Promise.allSettled(promises);
  }

  /**
   * Send location update for a single vehicle (Traccar-compatible format)
   */
  async sendVehicleLocation(vehicle) {
    try {
      // Generate realistic movement
      this.updateVehicleLocation(vehicle);
      
      // Prepare Traccar-compatible payload
      const payload = {
        deviceId: vehicle.deviceId,
        deviceToken: vehicle.deviceToken,
        location: {
          coords: {
            latitude: vehicle.currentLocation.lat,
            longitude: vehicle.currentLocation.lng,
            speed: vehicle.currentLocation.speed,
            heading: vehicle.currentLocation.heading,
            accuracy: vehicle.currentLocation.accuracy,
            altitude: 1122 + Math.random() * 100
          },
          battery: {
            level: 0.2 + Math.random() * 0.6, // 20-80% battery
            is_charging: Math.random() > 0.8 // 20% chance of charging
          },
          odometer: 123456 + Math.floor(Math.random() * 1000),
          timestamp: vehicle.currentLocation.timestamp.toISOString()
        }
      };

      // Send to your server's Traccar endpoint
      const response = await axios.post(
        `${this.serverUrl}/api/traccar/location`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Traccar-Simulator/1.0'
          },
          timeout: 10000
        }
      );

      console.log(`Location sent for ${vehicle.name}: ${vehicle.currentLocation.lat.toFixed(6)}, ${vehicle.currentLocation.lng.toFixed(6)} | Speed: ${vehicle.currentLocation.speed} km/h`);
      
      // Also emit via socket for real-time updates
      if (this.io) {
        const socketData = {
          vehicleId: vehicle._id,
          deviceId: vehicle.deviceId,
          latitude: vehicle.currentLocation.lat,
          longitude: vehicle.currentLocation.lng,
          speed: vehicle.currentLocation.speed,
          heading: vehicle.currentLocation.heading,
          accuracy: vehicle.currentLocation.accuracy,
          timestamp: vehicle.currentLocation.timestamp,
          vehicleName: vehicle.name,
          plateNumber: vehicle.plateNumber,
          driver: vehicle.driver,
          company: vehicle.company
        };
        
        this.io.emit('vehicle:location', socketData);
        this.io.to(`vehicle:${vehicle._id}`).emit('location:update', socketData);
      }
      
      return { success: true, vehicle: vehicle.name };
      
    } catch (error) {
      console.error(`Failed to send location for ${vehicle.name}:`, error.message);
      
      if (error.response) {
        console.error('Server response:', error.response.status, error.response.data);
      }
      
      return { success: false, vehicle: vehicle.name, error: error.message };
    }
  }

  /**
   * Update vehicle location with realistic movement
   */
  updateVehicleLocation(vehicle) {
    const currentLocation = vehicle.currentLocation;
    const previousLocation = vehicle.previousLocation || currentLocation;
    
    // Generate new location within polygon
    const newPoint = generateRandomPointInsidePolygon(OPERATIONAL_POLYGON);
    
    // Calculate distance and speed
    const distance = calculateDistance(
      previousLocation.lat,
      previousLocation.lng,
      newPoint.lat,
      newPoint.lng
    );
    
    const timeDiff = 30; // seconds between updates
    const speed = Math.min((distance / timeDiff) * 3.6, 120); // Convert to km/h, max 120
    
    // Calculate heading
    const heading = calculateBearing(
      previousLocation.lat,
      previousLocation.lng,
      newPoint.lat,
      newPoint.lng
    );
    
    // Update vehicle location
    vehicle.previousLocation = { ...currentLocation };
    vehicle.currentLocation = {
      lat: newPoint.lat,
      lng: newPoint.lng,
      speed: Math.round(speed),
      heading: Math.round(heading),
      accuracy: 5 + Math.random() * 20, // 5-25 meters accuracy
      timestamp: new Date()
    };
    
    // Check for violations
    this.checkForViolations(vehicle);
    
    // Check geofence boundaries
    this.checkGeofenceEvents(vehicle);
  }

  /**
   * Check for driving violations
   */
  checkForViolations(vehicle) {
    const location = vehicle.currentLocation;
    
    // Speeding violation (over 80 km/h)
    if (location.speed > 80) {
      const violation = {
        id: `viol_${Date.now()}_${vehicle._id}`,
        vehicleId: vehicle._id,
        vehicleName: vehicle.name,
        deviceId: vehicle.deviceId,
        type: 'speeding',
        severity: location.speed > 100 ? 'high' : 'medium',
        details: {
          speed: location.speed,
          limit: 80,
          location: { lat: location.lat, lng: location.lng }
        },
        timestamp: new Date(),
        driver: vehicle.driver.name,
        company: vehicle.company
      };
      
      this.emitViolation(violation);
    }
    
    // Random hard brake or acceleration
    if (Math.random() < 0.05) {
      const violationType = Math.random() > 0.5 ? 'hard_brake' : 'rapid_acceleration';
      const violation = {
        id: `viol_${Date.now()}_${vehicle._id}`,
        vehicleId: vehicle._id,
        vehicleName: vehicle.name,
        deviceId: vehicle.deviceId,
        type: violationType,
        severity: 'medium',
        details: {
          location: { lat: location.lat, lng: location.lng },
          timestamp: new Date()
        },
        timestamp: new Date(),
        driver: vehicle.driver.name,
        company: vehicle.company
      };
      
      this.emitViolation(violation);
    }
  }

  /**
   * Check geofence events
   */
  checkGeofenceEvents(vehicle) {
    // This would integrate with your zone manager
    // For now, simulate random geofence events
    if (Math.random() < 0.1) {
      const eventType = Math.random() > 0.5 ? 'enter' : 'exit';
      const geofenceName = eventType === 'enter' ? 'Nairobi CBD' : 'Industrial Area';
      
      const event = {
        vehicleId: vehicle._id,
        vehicleName: vehicle.name,
        eventType: eventType,
        geofenceName: geofenceName,
        location: { ...vehicle.currentLocation },
        timestamp: new Date()
      };
      
      this.emitGeofenceEvent(event);
    }
  }

  /**
   * Emit violation via socket
   */
  emitViolation(violation) {
    if (this.io) {
      this.io.emit('violation:alert', violation);
      this.io.to('admin:room').emit('violation:detected', violation);
      
      console.log(`Violation: ${violation.vehicleName} - ${violation.type} (${violation.severity})`);
      
      // Also send to API endpoint
      this.sendViolationToApi(violation);
    }
  }

  /**
   * Send violation to API
   */
  async sendViolationToApi(violation) {
    try {
      await axios.post(
        `${this.serverUrl}/api/violations`,
        violation,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      console.error('Failed to send violation to API:', error.message);
    }
  }

  /**
   * Emit geofence event via socket
   */
  emitGeofenceEvent(event) {
    if (this.io) {
      this.io.emit('geofence:event', event);
      this.io.to('admin:room').emit('geofence:activity', event);
      
      console.log(`${event.vehicleName} ${event.eventType}ed ${event.geofenceName}`);
    }
  }

  /**
   * Update random vehicle status
   */
  updateRandomVehicleStatus() {
    this.simulatedVehicles.forEach(vehicle => {
      // 10% chance to toggle status
      if (Math.random() < 0.1) {
        const newStatus = vehicle.status === 'active' ? 'inactive' : 'active';
        vehicle.status = newStatus;
        
        console.log(`${vehicle.name} status changed to ${newStatus}`);
        
        // Emit status change
        if (this.io) {
          this.io.emit('vehicle:status', {
            vehicleId: vehicle._id,
            deviceId: vehicle.deviceId,
            status: newStatus,
            timestamp: new Date()
          });
        }
      }
    });
  }

  /**
   * Get simulator status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      vehicleCount: this.simulatedVehicles.length,
      activeVehicles: this.simulatedVehicles.filter(v => v.status === 'active').length,
      updateInterval: this.updateInterval,
      serverUrl: this.serverUrl,
      lastUpdate: new Date()
    };
  }

  /**
   * Get simulated vehicles
   */
  getVehicles() {
    return this.simulatedVehicles.map(vehicle => ({
      id: vehicle._id,
      deviceId: vehicle.deviceId,
      name: vehicle.name,
      plateNumber: vehicle.plateNumber,
      type: vehicle.type,
      status: vehicle.status,
      driver: vehicle.driver,
      company: vehicle.company,
      currentLocation: vehicle.currentLocation
    }));
  }

  /**
   * Manually control a vehicle
   */
  controlVehicle(vehicleId, command) {
    const vehicle = this.simulatedVehicles.find(v => v._id === vehicleId);
    if (!vehicle) return { success: false, error: 'Vehicle not found' };
    
    switch (command.action) {
      case 'set_location':
        vehicle.currentLocation.lat = command.lat;
        vehicle.currentLocation.lng = command.lng;
        return { success: true, location: vehicle.currentLocation };
      
      case 'set_status':
        vehicle.status = command.status;
        return { success: true, status: vehicle.status };
      
      case 'trigger_violation':
        const violation = {
          vehicleId: vehicle._id,
          vehicleName: vehicle.name,
          type: command.type || 'speeding',
          severity: command.severity || 'medium',
          details: command.details || {},
          timestamp: new Date()
        };
        this.emitViolation(violation);
        return { success: true, violation };
      
      default:
        return { success: false, error: 'Unknown command' };
    }
  }
}

// Singleton instance
let simulatorInstance = null;

function startSimulator(io) {
  if (!simulatorInstance) {
    simulatorInstance = new TraccarSimulator(io);
  }
  
  simulatorInstance.start();
  return simulatorInstance;
}

function stopSimulator() {
  if (simulatorInstance) {
    simulatorInstance.stop();
  }
}

function getSimulator() {
  return simulatorInstance;
}

module.exports = {
  TraccarSimulator,
  startSimulator,
  stopSimulator,
  getSimulator
};