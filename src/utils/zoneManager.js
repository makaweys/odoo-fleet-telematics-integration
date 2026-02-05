// utils/zoneManager.js - Fixed version
const Geofence = require('../models/Geofence');
const Poi = require('../models/Poi');
const Zone = require('../models/Zone');

// In-memory zone cache
let zonesCache = {
  geofences: [],
  pois: [],
  zones: [], // Added zones array
  lastUpdated: null
};

// Default dummy zones for testing
const dummyGeofences = [
  {
    _id: 'geo_dummy_1',
    name: 'Nairobi CBD',
    type: 'polygon',
    path: [
      { lat: -1.2921, lng: 36.8219 },
      { lat: -1.2800, lng: 36.8300 },
      { lat: -1.2900, lng: 36.8400 },
      { lat: -1.3000, lng: 36.8300 }
    ]
  },
  {
    _id: 'geo_dummy_2',
    name: 'Industrial Area',
    type: 'polygon',
    path: [
      { lat: -1.3100, lng: 36.8100 },
      { lat: -1.3200, lng: 36.8200 },
      { lat: -1.3300, lng: 36.8100 },
      { lat: -1.3200, lng: 36.8000 }
    ]
  }
];

const dummyPOIs = [
  {
    _id: 'poi_dummy_1',
    name: 'Central Warehouse',
    location: { lat: -1.2921, lng: 36.8219 },
    radius: 500 // meters
  },
  {
    _id: 'poi_dummy_2',
    name: 'Main Office',
    location: { lat: -1.2800, lng: 36.8300 },
    radius: 300
  }
];

// Add dummy zones array
const dummyZones = [
  {
    _id: 'zone_dummy_1',
    name: 'Nairobi Operations',
    description: 'Nairobi metropolitan area operations zone',
    assignedGeofeatures: {
      geofences: ['geo_dummy_1', 'geo_dummy_2'],
      pois: ['poi_dummy_1', 'poi_dummy_2']
    }
  }
];

/**
 * Load zones from database or use dummy data
 */
async function loadZones(db) {
  try {
    console.log('Loading zones...');
    
    if (db.connected) {
      console.log('Loading zones from MongoDB...');
      
      // Load from MongoDB using the models
      const [zones, geofences, pois] = await Promise.all([
        Zone.find({}),
        Geofence.find({}),
        Poi.find({})
      ]);
      
      zonesCache = {
        zones: zones || [],
        geofences: geofences || [],
        pois: pois || [],
        lastUpdated: new Date()
      };
      
      console.log(`Zones loaded: ${zones.length} zones, ${geofences.length} geofences, ${pois.length} POIs`);
    } else {
      // Use dummy data for testing
      console.log('Using dummy zones for testing...');
      zonesCache = {
        zones: dummyZones,
        geofences: dummyGeofences,
        pois: dummyPOIs,
        lastUpdated: new Date()
      };
      
      console.log('Dummy zones loaded for testing');
    }
  } catch (error) {
    console.error('Error loading zones:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Fallback to dummy data
    zonesCache = {
      zones: dummyZones,
      geofences: dummyGeofences,
      pois: dummyPOIs,
      lastUpdated: new Date()
    };
    console.log('⚠️ Fallback to dummy zones due to error');
  }
}

/**
 * Get all zones
 */
function getZones() {
  return zonesCache;
}

/**
 * Get normalized zones (flattened array)
 */
function getNormalizedZones() {
  const normalized = [];
  
  zonesCache.geofences.forEach(gf => {
    normalized.push({
      id: gf._id ? gf._id.toString() : gf.id,
      name: gf.name,
      type: 'geofence'
    });
  });
  
  zonesCache.pois.forEach(poi => {
    normalized.push({
      id: poi._id ? poi._id.toString() : poi.id,
      name: poi.name,
      type: 'poi'
    });
  });
  
  zonesCache.zones.forEach(zone => {
    normalized.push({
      id: zone._id ? zone._id.toString() : zone.id,
      name: zone.name,
      type: 'zone'
    });
  });
  
  return normalized;
}

/**
 * Find which zone/geofence/poi a location is in
 */
function checkLocation(lat, lng) {
  const results = {
    zones: [],
    geofences: [],
    pois: []
  };
  
  // Check geofences (simple point-in-polygon for demo)
  zonesCache.geofences.forEach(gf => {
    if (gf.path && isPointInPolygon(lat, lng, gf.path)) {
      results.geofences.push({
        id: gf._id,
        name: gf.name,
        type: gf.type
      });
    }
  });
  
  // Check POIs (within radius)
  zonesCache.pois.forEach(poi => {
    if (poi.location && poi.radius) {
      const distance = calculateDistance(lat, lng, poi.location.lat, poi.location.lng);
      if (distance <= poi.radius) {
        results.pois.push({
          id: poi._id,
          name: poi.name,
          distance: Math.round(distance)
        });
      }
    }
  });
  
  return results;
}

// Helper function: Point in polygon
function isPointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Helper function: Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Refresh zones cache
 */
async function refreshZones(db) {
  try {
    await loadZones(db);
    console.log('Zones cache refreshed');
    return { success: true, timestamp: new Date() };
  } catch (error) {
    console.error('Error refreshing zones:', error);
    return { success: false, error: error.message };
  }
}

// Auto-refresh every 5 minutes
let refreshInterval;
function startAutoRefresh(db, interval = 5 * 60 * 1000) {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  refreshInterval = setInterval(() => {
    console.log('🔄 Auto-refreshing zones...');
    refreshZones(db);
  }, interval);
  
  console.log(`Auto-refresh scheduled every ${interval / 1000 / 60} minutes`);
}

module.exports = {
  loadZones,
  getZones,
  getNormalizedZones,
  checkLocation,
  refreshZones,
  startAutoRefresh
};