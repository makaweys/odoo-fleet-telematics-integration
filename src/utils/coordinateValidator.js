/**
 * Validate latitude value
 * @param {number|string} lat - Latitude value
 * @returns {boolean} - True if valid
 */
function isValidLatitude(lat) {
  try {
    const num = typeof lat === 'string' ? parseFloat(lat) : lat;
    return !isNaN(num) && num >= -90 && num <= 90;
  } catch (error) {
    return false;
  }
}

/**
 * Validate longitude value
 * @param {number|string} lng - Longitude value
 * @returns {boolean} - True if valid
 */
function isValidLongitude(lng) {
  try {
    const num = typeof lng === 'string' ? parseFloat(lng) : lng;
    return !isNaN(num) && num >= -180 && num <= 180;
  } catch (error) {
    return false;
  }
}

/**
 * Validate coordinate pair
 * @param {number|string} lat - Latitude
 * @param {number|string} lng - Longitude
 * @returns {Object} - Validation result
 */
function validateCoordinates(lat, lng) {
  const isValidLat = isValidLatitude(lat);
  const isValidLng = isValidLongitude(lng);
  
  return {
    valid: isValidLat && isValidLng,
    errors: {
      latitude: isValidLat ? null : 'Latitude must be between -90 and 90',
      longitude: isValidLng ? null : 'Longitude must be between -180 and 180'
    },
    coordinates: isValidLat && isValidLng ? {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    } : null
  };
}

module.exports = {
  isValidLatitude,
  isValidLongitude,
  validateCoordinates
};