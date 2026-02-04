// React Frontend API Examples - Vehicle Telematics Tracker

import axios from 'axios';

// Configure axios instance
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== Vehicle API ====================
export const vehicleApi = {
  /**
   * Get all vehicles with latest locations
   */
  getVehicles: async () => {
    try {
      const response = await api.get('/vehicles');
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      throw error;
    }
  },

  /**
   * Get vehicle by ID
   */
  getVehicle: async (vehicleId) => {
    try {
      const response = await api.get(`/vehicles/${vehicleId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      throw error;
    }
  },

  /**
   * Get dashboard statistics
   */
  getDashboardStats: async () => {
    try {
      const response = await api.get('/vehicles/dashboard-stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  /**
   * Get online vehicles count
   */
  getOnlineVehicles: async () => {
    try {
      const response = await api.get('/vehicles/online');
      return response.data;
    } catch (error) {
      console.error('Error fetching online vehicles:', error);
      throw error;
    }
  },

  /**
   * Assign zones to vehicle
   */
  assignZonesToVehicle: async (vehicleId, zoneIds) => {
    try {
      const response = await api.post(`/vehicles/${vehicleId}/assign-zones`, { zoneIds });
      return response.data;
    } catch (error) {
      console.error('Error assigning zones to vehicle:', error);
      throw error;
    }
  },

  /**
   * Get assigned zones for vehicle
   */
  getAssignedZones: async (vehicleId) => {
    try {
      const response = await api.get(`/vehicles/${vehicleId}/zones`);
      return response.data;
    } catch (error) {
      console.error('Error fetching assigned zones:', error);
      throw error;
    }
  },
};

// ==================== Location API ====================
export const locationApi = {
  /**
   * Send location update (for testing)
   */
  sendLocationUpdate: async (deviceId, locationData) => {
    try {
      const response = await api.post('/traccar/location', {
        device_id: deviceId,
        location: locationData,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending location update:', error);
      throw error;
    }
  },

  /**
   * Get active vehicles with locations
   */
  getActiveVehicles: async () => {
    try {
      const response = await api.get('/traccar/vehicles/active');
      return response.data;
    } catch (error) {
      console.error('Error fetching active vehicles:', error);
      throw error;
    }
  },

  /**
   * Get vehicle status
   */
  getVehicleStatus: async (deviceId) => {
    try {
      const response = await api.get(`/traccar/vehicles/${deviceId}/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicle status:', error);
      throw error;
    }
  },
};

// ==================== Odoo Integration API ====================
export const odooApi = {
  /**
   * Sync vehicle from Odoo
   */
  syncVehicle: async (vehicleData) => {
    try {
      const response = await api.post('/odoo/vehicles/sync', vehicleData);
      return response.data;
    } catch (error) {
      console.error('Error syncing vehicle from Odoo:', error);
      throw error;
    }
  },

  /**
   * Assign trip to vehicle
   */
  assignTrip: async (tripData) => {
    try {
      const response = await api.post('/odoo/trips/assign', tripData);
      return response.data;
    } catch (error) {
      console.error('Error assigning trip:', error);
      throw error;
    }
  },

  /**
   * Sync customer POI from Odoo
   */
  syncCustomerPoi: async (customerData) => {
    try {
      const response = await api.post('/odoo/customers/sync-poi', customerData);
      return response.data;
    } catch (error) {
      console.error('Error syncing customer POI:', error);
      throw error;
    }
  },

  /**
   * Bulk sync customer POIs
   */
  bulkSyncCustomerPois: async (customers) => {
    try {
      const response = await api.post('/odoo/customers/bulk-sync-pois', { customers });
      return response.data;
    } catch (error) {
      console.error('Error bulk syncing customer POIs:', error);
      throw error;
    }
  },

  /**
   * Get customer POIs by IDs
   */
  getCustomerPois: async (customerIds) => {
    try {
      const response = await api.post('/odoo/customers/get-pois', { customerIds });
      return response.data;
    } catch (error) {
      console.error('Error getting customer POIs:', error);
      throw error;
    }
  },

  /**
   * Get active trips
   */
  getActiveTrips: async () => {
    try {
      const response = await api.get('/odoo/trips/active');
      return response.data;
    } catch (error) {
      console.error('Error fetching active trips:', error);
      throw error;
    }
  },

  /**
   * Complete trip
   */
  completeTrip: async (tripId, vehicleId) => {
    try {
      const response = await api.post('/odoo/trips/complete', { tripId, vehicleId });
      return response.data;
    } catch (error) {
      console.error('Error completing trip:', error);
      throw error;
    }
  },
};

// ==================== Geofence API ====================
export const geofenceApi = {
  /**
   * Get all geofences
   */
  getGeofences: async () => {
    try {
      const response = await api.get('/geofences');
      return response.data;
    } catch (error) {
      console.error('Error fetching geofences:', error);
      throw error;
    }
  },

  /**
   * Create polygon geofence
   */
  createPolygonGeofence: async (name, path, description = '') => {
    try {
      const response = await api.post('/geofences', {
        name,
        description,
        type: 'polygon',
        path: path.map(p => ({ lat: p.lat, lng: p.lng })),
      });
      return response.data;
    } catch (error) {
      console.error('Error creating polygon geofence:', error);
      throw error;
    }
  },

  /**
   * Create route geofence
   */
  createRouteGeofence: async (name, start, end, routePolyline, description = '') => {
    try {
      const response = await api.post('/geofences', {
        name,
        description,
        type: 'route',
        start,
        end,
        routePolyline,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating route geofence:', error);
      throw error;
    }
  },

  /**
   * Update geofence
   */
  updateGeofence: async (geofenceId, updates) => {
    try {
      const response = await api.put(`/geofences/${geofenceId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating geofence:', error);
      throw error;
    }
  },

  /**
   * Delete geofence
   */
  deleteGeofence: async (geofenceId) => {
    try {
      const response = await api.delete(`/geofences/${geofenceId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting geofence:', error);
      throw error;
    }
  },
};

// ==================== POI API ====================
export const poiApi = {
  /**
   * Get all POIs
   */
  getPois: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/pois${params ? `?${params}` : ''}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching POIs:', error);
      throw error;
    }
  },

  /**
   * Get POI by ID
   */
  getPoi: async (poiId) => {
    try {
      const response = await api.get(`/pois/${poiId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching POI:', error);
      throw error;
    }
  },

  /**
   * Get POI by Odoo customer ID
   */
  getPoiByOdooId: async (odooCustomerId) => {
    try {
      const response = await api.get(`/pois/odoo/${odooCustomerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching POI by Odoo ID:', error);
      throw error;
    }
  },

  /**
   * Create POI
   */
  createPoi: async (poiData) => {
    try {
      const response = await api.post('/pois', poiData);
      return response.data;
    } catch (error) {
      console.error('Error creating POI:', error);
      throw error;
    }
  },

  /**
   * Update POI
   */
  updatePoi: async (poiId, updates) => {
    try {
      const response = await api.put(`/pois/${poiId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating POI:', error);
      throw error;
    }
  },

  /**
   * Delete POI
   */
  deletePoi: async (poiId) => {
    try {
      const response = await api.delete(`/pois/${poiId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting POI:', error);
      throw error;
    }
  },
};

// ==================== Zone API ====================
export const zoneApi = {
  /**
   * Get all zones
   */
  getZones: async () => {
    try {
      const response = await api.get('/zones');
      return response.data;
    } catch (error) {
      console.error('Error fetching zones:', error);
      throw error;
    }
  },

  /**
   * Get zone by ID
   */
  getZone: async (zoneId) => {
    try {
      const response = await api.get(`/zones/${zoneId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching zone:', error);
      throw error;
    }
  },

  /**
   * Create zone
   */
  createZone: async (zoneData) => {
    try {
      const response = await api.post('/zones', zoneData);
      return response.data;
    } catch (error) {
      console.error('Error creating zone:', error);
      throw error;
    }
  },

  /**
   * Update zone
   */
  updateZone: async (zoneId, updates) => {
    try {
      const response = await api.put(`/zones/${zoneId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating zone:', error);
      throw error;
    }
  },

  /**
   * Delete zone
   */
  deleteZone: async (zoneId) => {
    try {
      const response = await api.delete(`/zones/${zoneId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting zone:', error);
      throw error;
    }
  },

  /**
   * Add geofence to zone
   */
  addGeofenceToZone: async (zoneId, geofenceId) => {
    try {
      const response = await api.post(`/zones/${zoneId}/geofences/${geofenceId}`);
      return response.data;
    } catch (error) {
      console.error('Error adding geofence to zone:', error);
      throw error;
    }
  },

  /**
   * Add POI to zone
   */
  addPoiToZone: async (zoneId, poiId) => {
    try {
      const response = await api.post(`/zones/${zoneId}/pois/${poiId}`);
      return response.data;
    } catch (error) {
      console.error('Error adding POI to zone:', error);
      throw error;
    }
  },

  /**
   * Remove geofence from zone
   */
  removeGeofenceFromZone: async (zoneId, geofenceId) => {
    try {
      const response = await api.delete(`/zones/${zoneId}/geofences/${geofenceId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing geofence from zone:', error);
      throw error;
    }
  },

  /**
   * Remove POI from zone
   */
  removePoiFromZone: async (zoneId, poiId) => {
    try {
      const response = await api.delete(`/zones/${zoneId}/pois/${poiId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing POI from zone:', error);
      throw error;
    }
  },
};

// ==================== WebSocket Setup ====================
export const setupWebSocket = (options = {}) => {
  const {
    onLocationUpdate,
    onZoneEvent,
    onViolation,
    onVehicleUpdate,
    onPoiSynced
  } = options;

  const socket = new WebSocket(`ws://localhost:5000`);

  socket.onopen = () => {
    console.log('WebSocket connected');
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type || data.event) {
        case 'vehicle:location:update':
          onLocationUpdate?.(data);
          break;
        case 'zone:event':
        case 'zone:entry':
        case 'zone:exit':
          onZoneEvent?.(data);
          break;
        case 'violation:detected':
          onViolation?.(data);
          break;
        case 'vehicle:update':
        case 'vehicle:synced':
          onVehicleUpdate?.(data);
          break;
        case 'poi:odoo:synced':
          onPoiSynced?.(data);
          break;
        default:
          console.log('Unknown WebSocket event:', data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected');
  };

  return socket;
};

// Example usage in React component:
/*
import React, { useEffect, useState } from 'react';
import { vehicleApi, locationApi, setupWebSocket } from './react-examples';

function Dashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [activeVehicles, setActiveVehicles] = useState([]);

  useEffect(() => {
    // Load vehicles
    vehicleApi.getVehicles().then(data => setVehicles(data.data));
    
    // Load active vehicles
    locationApi.getActiveVehicles().then(data => setActiveVehicles(data.vehicles));
    
    // Setup WebSocket for real-time updates
    const socket = setupWebSocket({
      onLocationUpdate: (data) => {
        console.log('Location update:', data);
        // Update your state
      },
      onViolation: (data) => {
        alert(`Violation: ${data.reason}`);
      }
    });
    
    return () => socket.close();
  }, []);
  
  return (
    <div>
      <h1>Vehicle Dashboard</h1>
      <p>Total vehicles: {vehicles.length}</p>
      <p>Active vehicles: {activeVehicles.length}</p>
    </div>
  );
}
*/