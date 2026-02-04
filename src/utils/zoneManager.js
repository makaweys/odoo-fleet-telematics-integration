// In-memory zone cache
let zonesCache = {
  geofences: [],
  pois: [],
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

/**
 * Load zones from database or use dummy data
 */
// Update the loadZones function to work with the new structure
async function loadZones(db) {
  try {
    if (db.connected) {
      // Load from MongoDB using the new models
      const Geofence = require('../models/Geofence');
      const Poi = require('../models/Poi');
      const Zone = require('../models/Zone');
      
      // Get all zones with populated geofences and POIs
      const zones = await Zone.find()
        .populate('assignedGeofeatures.geofences')
        .populate('assignedGeofeatures.pois');
      
      // Flatten all geofences and POIs from zones
      const allGeofences = [];
      const allPois = [];
      
      zones.forEach(zone => {
        if (zone.assignedGeofeatures.geofences) {
          allGeofences.push(...zone.assignedGeofeatures.geofences);
        }
        if (zone.assignedGeofeatures.pois) {
          allPois.push(...zone.assignedGeofeatures.pois);
        }
      });
      
      // Remove duplicates
      const uniqueGeofences = Array.from(new Map(allGeofences.map(g => [g._id.toString(), g])).values());
      const uniquePois = Array.from(new Map(allPois.map(p => [p._id.toString(), p])).values());
      
      zonesCache = {
        zones,
        geofences: uniqueGeofences,
        pois: uniquePois,
        lastUpdated: new Date()
      };
      
      console.log(`Zones loaded: ${zones.length} zones, ${uniqueGeofences.length} geofences, ${uniquePois.length} POIs`);
    } else {
      // Use dummy data for testing
      zonesCache = {
        zones: dummyZones,
        geofences: dummyGeofences,
        pois: dummyPOIs,
        lastUpdated: new Date()
      };
      
      console.log('Using dummy zones for testing');
    }
  } catch (error) {
    console.error('Error loading zones:', error);
    // Fallback to dummy data
    zonesCache = {
      zones: dummyZones,
      geofences: dummyGeofences,
      pois: dummyPOIs,
      lastUpdated: new Date()
    };
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
  
  return normalized;
}

/**
 * Refresh zones cache
 */
async function refreshZones(db) {
  await loadZones(db);
  console.log('🔄 Zones cache refreshed');
}

// Auto-refresh every 5 minutes
let refreshInterval;
function startAutoRefresh(db, interval = 5 * 60 * 1000) {
  if (refreshInterval) clearInterval(refreshInterval);
  
  refreshInterval = setInterval(() => {
    refreshZones(db);
  }, interval);
  
  console.log(`⏰ Auto-refresh scheduled every ${interval / 1000 / 60} minutes`);
}

module.exports = {
  loadZones,
  getZones,
  getNormalizedZones,
  refreshZones,
  startAutoRefresh
};