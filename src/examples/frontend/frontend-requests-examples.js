// Example React component for managing geofences
import axios from 'axios';

const API_BASE = 'http://your-server.com/api';

// Create a new geofence (polygon)
const createPolygonGeofence = async (name, path) => {
  const response = await axios.post(`${API_BASE}/geofences`, {
    name,
    type: 'polygon',
    path: path.map(point => ({ lat: point.lat, lng: point.lng }))
  });
  return response.data;
};

// Create a route geofence (using Google Maps Directions API)
const createRouteGeofence = async (name, start, end, waypoints, polyline) => {
  const response = await axios.post(`${API_BASE}/geofences`, {
    name,
    type: 'route',
    start: { lat: start.lat, lng: start.lng, address: start.address },
    end: { lat: end.lat, lng: end.lng, address: end.address },
    routePolyline: polyline
  });
  return response.data;
};

// Create a POI (customer location)
const createPoi = async (name, location, odooCustomerId) => {
  const response = await axios.post(`${API_BASE}/pois`, {
    name,
    location: { lat: location.lat, lng: location.lng },
    radius: 100, // meters
    odooCustomerId,
    isCustomer: true
  });
  return response.data;
};

// Create a zone and assign geofences/POIs
const createZone = async (name, geofenceIds, poiIds) => {
  const response = await axios.post(`${API_BASE}/zones`, {
    name,
    description: 'Delivery route zone',
    assignedGeofeatures: {
      geofences: geofenceIds,
      pois: poiIds
    }
  });
  return response.data;
};

// Get all zones for display on map
const getAllZones = async () => {
  const response = await axios.get(`${API_BASE}/zones`);
  return response.data;
};

// Update a zone (add/remove geofences/POIs)
const updateZone = async (zoneId, updates) => {
  const response = await axios.put(`${API_BASE}/zones/${zoneId}`, updates);
  return response.data;
};