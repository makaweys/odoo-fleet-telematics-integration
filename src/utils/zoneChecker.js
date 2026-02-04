const geolib = require('geolib');
const { getZones } = require('./zoneManager');

/**
 * Check which zones a location is within
 */
function checkZones(location) {
  const { latitude: lat, longitude: lng } = location;
  const zones = getZones();
  const matches = [];

  // Check POIs
  (zones.pois || []).forEach(poi => {
    const distance = geolib.getDistance(
      { latitude: lat, longitude: lng },
      { latitude: poi.location.lat, longitude: poi.location.lng }
    );
    
    if (distance <= poi.radius) {
      matches.push({
        id: poi._id ? poi._id.toString() : poi.id,
        type: 'poi',
        name: poi.name || 'Unknown POI',
        distance
      });
    }
  });

  // Check Geofences
  (zones.geofences || []).forEach(gf => {
    if (gf.path && gf.path.length > 2) {
      const points = gf.path.map(p => ({ 
        latitude: p.lat, 
        longitude: p.lng 
      }));
      
      const isInside = geolib.isPointInPolygon(
        { latitude: lat, longitude: lng },
        points
      );
      
      if (isInside) {
        matches.push({
          id: gf._id ? gf._id.toString() : gf.id,
          type: 'geofence',
          name: gf.name || 'Unknown Geofence'
        });
      }
    }
  });

  return matches;
}

module.exports = { checkZones };