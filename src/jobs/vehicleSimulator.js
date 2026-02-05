// jobs/vehicleSimulator.js - Fixed Traccar-compatible vehicle simulator
const axios = require('axios');

// Traccar-compatible polygon area
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

// Simulated vehicles that mimic real Traccar devices
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
  constructor() {
    this.simulatedVehicles = [...SIMULATED_VEHICLES];
    this.simulationInterval = null;
    this.updateInterval = 30000; // 30 seconds (typical GPS update interval)
    this.serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    this.isRunning = false;
    this.requestCount = 0;
    this.errorCount = 0;
    
    console.log('Traccar Simulator initialized with ' + this.simulatedVehicles.length + ' vehicles');
    console.log('Server URL: ' + this.serverUrl);
  }

  start() {
    if (this.isRunning) {
      console.log('Simulation already running');
      return;
    }

    console.log('Starting Traccar-compatible vehicle simulation...');
    console.log('Update interval: ' + this.updateInterval / 1000 + ' seconds');
    
    this.isRunning = true;
    this.requestCount = 0;
    this.errorCount = 0;
    
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

  stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    this.isRunning = false;
    console.log('Traccar simulation stopped');
    console.log('Total requests: ' + this.requestCount + ', Errors: ' + this.errorCount);
  }

  async sendAllLocationUpdates() {
    const activeVehicles = this.simulatedVehicles.filter(vehicle => vehicle.status === 'active');
    
    if (activeVehicles.length === 0) {
      console.log('No active vehicles to simulate');
      return;
    }

    console.log('Sending location updates for ' + activeVehicles.length + ' active vehicles');
    
    const promises = activeVehicles.map(vehicle => this.sendVehicleLocation(vehicle));
    const results = await Promise.allSettled(promises);
    
    // Log results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.value && !r.value.success)).length;
    
    console.log('Update results: ' + successful + ' successful, ' + failed + ' failed');
  }

  async sendVehicleLocation(vehicle) {
    this.requestCount++;
    
    try {
      // Generate realistic movement
      this.updateVehicleLocation(vehicle);
      
      // Prepare CORRECT Traccar-compatible payload according to your route validation
      // Based on the updated traccarRoutes.js validation requirements
      const payload = {
        device_id: vehicle.deviceId,  // Required: device_id must exist
        location: {                    // Required: location object must exist
          coords: {                    // Required: coords object must exist
            latitude: vehicle.currentLocation.lat,  // Required: valid latitude
            longitude: vehicle.currentLocation.lng, // Required: valid longitude
            speed: vehicle.currentLocation.speed || 0,  // Optional, but provided
            heading: vehicle.currentLocation.heading || 0, // Optional, but provided
            accuracy: vehicle.currentLocation.accuracy || 10, // Optional, but provided
            altitude: 1122 + Math.random() * 100 // Optional
          },
          battery: {
            level: 0.2 + Math.random() * 0.6, // 20-80% battery
            is_charging: Math.random() > 0.8 // 20% chance of charging
          },
          odometer: 123456 + Math.floor(Math.random() * 1000),
          is_moving: vehicle.currentLocation.speed > 5,
          timestamp: vehicle.currentLocation.timestamp.toISOString() // Valid ISO string
        }
      };

      // Add device token if available (for authentication)
      if (vehicle.deviceToken) {
        payload.deviceToken = vehicle.deviceToken;
      }

      // Log the payload being sent (for debugging)
      console.log('Sending payload for ' + vehicle.name + ':', {
        device_id: payload.device_id,
        has_location: !!payload.location,
        has_coords: !!payload.location.coords,
        latitude: payload.location.coords.latitude,
        longitude: payload.location.coords.longitude,
        timestamp: payload.location.timestamp
      });

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

      console.log('Location sent for ' + vehicle.name + ': ' + 
        vehicle.currentLocation.lat.toFixed(6) + ', ' + 
        vehicle.currentLocation.lng.toFixed(6) + ' | Speed: ' + 
        vehicle.currentLocation.speed + ' km/h | Status: ' + response.status);
      
      return { 
        success: true, 
        vehicle: vehicle.name,
        status: response.status 
      };
      
    } catch (error) {
      this.errorCount++;
      
      if (error.response) {
        console.error('Failed to send location for ' + vehicle.name + ':', 
          'Status: ' + error.response.status, 
          'Error: ' + JSON.stringify(error.response.data));
        
        // Log detailed error information
        if (error.response.data && error.response.data.details) {
          console.error('Validation errors:', error.response.data.details);
        }
      } else if (error.request) {
        console.error('Failed to send location for ' + vehicle.name + ': No response received');
      } else {
        console.error('Failed to send location for ' + vehicle.name + ':', error.message);
      }
      
      return { 
        success: false, 
        vehicle: vehicle.name, 
        error: error.message,
        response: error.response ? error.response.data : null
      };
    }
  }

  updateVehicleLocation(vehicle) {
    const currentLocation = vehicle.currentLocation;
    const previousLocation = vehicle.previousLocation || currentLocation;
    
    // Generate new location within polygon
    const newPoint = generateRandomPointInsidePolygon(OPERATIONAL_POLYGON);
    
    // Calculate distance and speed (keep it realistic)
    const distance = calculateDistance(
      previousLocation.lat,
      previousLocation.lng,
      newPoint.lat,
      newPoint.lng
    );
    
    const timeDiff = 30; // seconds between updates
    const speed = Math.min((distance / timeDiff) * 3.6, 80); // Convert to km/h, max 80 (realistic)
    
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
      accuracy: 5 + Math.random() * 15, // 5-20 meters accuracy (realistic)
      timestamp: new Date()
    };
  }

  updateRandomVehicleStatus() {
    this.simulatedVehicles.forEach(vehicle => {
      // 5% chance to toggle status (less frequent)
      if (Math.random() < 0.05) {
        const newStatus = vehicle.status === 'active' ? 'inactive' : 'active';
        vehicle.status = newStatus;
        
        console.log(vehicle.name + ' status changed to ' + newStatus);
      }
    });
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      vehicleCount: this.simulatedVehicles.length,
      activeVehicles: this.simulatedVehicles.filter(v => v.status === 'active').length,
      updateInterval: this.updateInterval,
      serverUrl: this.serverUrl,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      lastUpdate: new Date()
    };
  }

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

  controlVehicle(vehicleId, command) {
    const vehicle = this.simulatedVehicles.find(v => v._id === vehicleId);
    if (!vehicle) return { success: false, error: 'Vehicle not found' };
    
    switch (command.action) {
      case 'set_location':
        vehicle.currentLocation.lat = command.lat;
        vehicle.currentLocation.lng = command.lng;
        vehicle.currentLocation.timestamp = new Date();
        return { success: true, location: vehicle.currentLocation };
      
      case 'set_status':
        vehicle.status = command.status;
        return { success: true, status: vehicle.status };
      
      case 'set_speed':
        vehicle.currentLocation.speed = command.speed;
        return { success: true, speed: vehicle.currentLocation.speed };
      
      default:
        return { success: false, error: 'Unknown command' };
    }
  }

  addVehicle(vehicleData) {
    const newVehicle = {
      _id: 'sim_' + Date.now(),
      deviceId: vehicleData.deviceId || 'T' + (this.simulatedVehicles.length + 1).toString().padStart(3, '0'),
      deviceToken: vehicleData.deviceToken || 'device_token_' + Date.now(),
      name: vehicleData.name || 'Simulated Vehicle ' + (this.simulatedVehicles.length + 1),
      plateNumber: vehicleData.plateNumber || 'SIM-' + Date.now().toString().slice(-4),
      type: vehicleData.type || 'car',
      driver: vehicleData.driver || { name: 'Test Driver', phone: '+254700000000' },
      company: vehicleData.company || 'Test Company',
      status: 'active',
      currentLocation: {
        lat: vehicleData.lat || -1.2921,
        lng: vehicleData.lng || 36.8219,
        speed: 0,
        heading: 0,
        accuracy: 15,
        timestamp: new Date()
      }
    };
    
    this.simulatedVehicles.push(newVehicle);
    
    return {
      success: true,
      vehicle: newVehicle,
      message: 'Vehicle added to simulation'
    };
  }

  // Test function to validate payload structure
  testPayloadStructure(vehicle) {
    const payload = {
      device_id: vehicle.deviceId,
      location: {
        coords: {
          latitude: vehicle.currentLocation.lat,
          longitude: vehicle.currentLocation.lng,
          speed: vehicle.currentLocation.speed || 0,
          heading: vehicle.currentLocation.heading || 0,
          accuracy: vehicle.currentLocation.accuracy || 10,
          altitude: 1122
        },
        battery: {
          level: 0.75,
          is_charging: false
        },
        odometer: 123456,
        is_moving: true,
        timestamp: new Date().toISOString()
      }
    };

    // Validate against your route requirements
    const validation = {
      hasDeviceId: !!payload.device_id && typeof payload.device_id === 'string',
      hasLocation: !!payload.location && typeof payload.location === 'object',
      hasCoords: !!payload.location.coords && typeof payload.location.coords === 'object',
      hasLatitude: payload.location.coords.latitude !== undefined && 
                  typeof payload.location.coords.latitude === 'number' &&
                  payload.location.coords.latitude >= -90 &&
                  payload.location.coords.latitude <= 90,
      hasLongitude: payload.location.coords.longitude !== undefined && 
                   typeof payload.location.coords.longitude === 'number' &&
                   payload.location.coords.longitude >= -180 &&
                   payload.location.coords.longitude <= 180,
      hasTimestamp: !!payload.location.timestamp && !isNaN(new Date(payload.location.timestamp).getTime())
    };

    console.log('Payload validation for ' + vehicle.name + ':', validation);
    
    const allValid = Object.values(validation).every(v => v === true);
    
    return {
      valid: allValid,
      validation,
      payload
    };
  }
}

// Singleton instance
let simulatorInstance = null;

function startSimulator() {
  if (!simulatorInstance) {
    simulatorInstance = new TraccarSimulator();
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

// Test the payload structure
function testSimulatorPayload() {
  const testVehicle = {
    deviceId: 'TEST_001',
    name: 'Test Vehicle',
    currentLocation: {
      lat: -1.2921,
      lng: 36.8219,
      speed: 45,
      heading: 90,
      accuracy: 10,
      timestamp: new Date()
    }
  };

  const simulator = new TraccarSimulator();
  return simulator.testPayloadStructure(testVehicle);
}

module.exports = {
  TraccarSimulator,
  startSimulator,
  stopSimulator,
  getSimulator,
  testSimulatorPayload
};