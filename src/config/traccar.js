module.exports = {
  // Traccar client configuration
  traccar: {
    // Expected update interval from Traccar app (in seconds)
    updateInterval: 30,
    
    // Maximum age of location data to consider valid (in minutes)
    maxDataAge: 5,
    
    // Minimum accuracy to consider location valid (in meters)
    minAccuracy: 100,
    
    // Battery level thresholds
    battery: {
      low: 0.2,      // 20%
      critical: 0.1  // 10%
    },
    
    // Speed conversion (m/s to km/h)
    speedConversion: 3.6,
    
    // WebSocket events
    events: {
      LOCATION_UPDATE: 'vehicle:location:update',
      ZONE_ENTRY: 'zone:entry',
      ZONE_EXIT: 'zone:exit',
      VIOLATION: 'violation:detected',
      BATTERY_LOW: 'battery:low'
    }
  },
  
  // Validation rules for incoming data
  validation: {
    requiredFields: ['device_id', 'location', 'location.coords'],
    coordinateRange: {
      latitude: { min: -90, max: 90 },
      longitude: { min: -180, max: 180 }
    },
    speedRange: { min: 0, max: 200 }, // km/h
    accuracyRange: { min: 0, max: 1000 } // meters
  }
};