const { checkZones } = require('./zoneChecker');
const { getNormalizedZones } = require('./zoneManager');

/**
 * Process location for zone violations
 */
async function processLocation(vehicleId, vehicle, location, telematics, assignedZones = null, io) {
  try {
    // Check which zones the vehicle is currently in
    const currentZones = checkZones(location);
    const currentZoneIds = currentZones.map(z => z.id);
    
    // Get all zones for reference
    const allZones = await getNormalizedZones();
    
    let event = 'in_zone';
    let geofenceId = null;
    let poiId = null;
    let violatedZones = [];

    // Extract one geofence and one POI from current zones
    currentZones.forEach(zone => {
      if (zone.type === 'geofence' && !geofenceId) {
        geofenceId = zone.id;
      }
      if (zone.type === 'poi' && !poiId) {
        poiId = zone.id;
      }
    });

    // Check if vehicle has assigned zones
    if (assignedZones && assignedZones.length > 0) {
      const assignedZoneIds = assignedZones.map(z => z.zone_id || z.id);
      const isInAssignedZone = currentZoneIds.some(id => assignedZoneIds.includes(id));
      
      if (!isInAssignedZone) {
        // Violation - outside assigned zones
        event = 'violation';
        violatedZones = assignedZoneIds;
        
        // Emit violation event
        if (io) {
          io.emit('violation:detected', {
            vehicleId,
            vehicle,
            location,
            reason: 'Outside assigned zones',
            violatedZones,
            timestamp: telematics.timestamp,
          });
        }
      }
    } else if (currentZoneIds.length === 0) {
      // No zones assigned and not in any zone
      event = 'outside_all_zones';
    }

    return {
      event,
      violatedZones,
      currentZoneIds,
      geofenceId,
      poiId,
    };
  } catch (error) {
    console.error('Error in violation processor:', error);
    return {
      event: 'error',
      violatedZones: [],
      currentZoneIds: [],
      geofenceId: null,
      poiId: null,
    };
  }
}

module.exports = { processLocation };