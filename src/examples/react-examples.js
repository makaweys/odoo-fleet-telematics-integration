// React Frontend API Examples - Vehicle Telematics Tracker

import axios from 'axios';

// Load configuration from environment or use defaults
const getApiBaseUrl = () => {
  // Check for React environment variable
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Check for .env file in development
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';
  }
  
  // Production default
  return '/api'; // Relative path for production
};

const getWebSocketUrl = () => {
  // Check for WebSocket URL in environment variables
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  
  // Try to construct from API URL
  const apiUrl = getApiBaseUrl();
  
  if (apiUrl.startsWith('http://')) {
    // Replace http:// with ws://
    return apiUrl.replace('http://', 'ws://').replace('/api', '');
  } else if (apiUrl.startsWith('https://')) {
    // Replace https:// with wss://
    return apiUrl.replace('https://', 'wss://').replace('/api', '');
  } else if (apiUrl.startsWith('/api')) {
    // Relative URL, use current host with ws
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }
  
  // Default
  return 'ws://localhost:5000';
};

const API_BASE = getApiBaseUrl();
const WS_URL = getWebSocketUrl();

console.log(`Using API base URL: ${API_BASE}`);
console.log(`Using WebSocket URL: ${WS_URL}`);

// Configure axios instance
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

// ==================== Simulator API ====================
export const simulatorApi = {
  /**
   * Get simulator status
   */
  getStatus: async () => {
    try {
      const response = await api.get('/simulator/status');
      return response.data;
    } catch (error) {
      console.error('Error fetching simulator status:', error);
      throw error;
    }
  },

  /**
   * Get all simulated vehicles
   */
  getSimulatedVehicles: async () => {
    try {
      const response = await api.get('/simulator/vehicles');
      return response.data;
    } catch (error) {
      console.error('Error fetching simulated vehicles:', error);
      throw error;
    }
  },

  /**
   * Start the simulator
   */
  startSimulator: async () => {
    try {
      const response = await api.post('/simulator/control', { action: 'start' });
      return response.data;
    } catch (error) {
      console.error('Error starting simulator:', error);
      throw error;
    }
  },

  /**
   * Stop the simulator
   */
  stopSimulator: async () => {
    try {
      const response = await api.post('/simulator/control', { action: 'stop' });
      return response.data;
    } catch (error) {
      console.error('Error stopping simulator:', error);
      throw error;
    }
  },

  /**
   * Restart the simulator
   */
  restartSimulator: async () => {
    try {
      const response = await api.post('/simulator/control', { action: 'restart' });
      return response.data;
    } catch (error) {
      console.error('Error restarting simulator:', error);
      throw error;
    }
  },

  /**
   * Trigger manual location updates
   */
  triggerLocationUpdates: async () => {
    try {
      const response = await api.post('/simulator/update-locations');
      return response.data;
    } catch (error) {
      console.error('Error triggering location updates:', error);
      throw error;
    }
  },

  /**
   * Add a new simulated vehicle
   */
  addSimulatedVehicle: async (vehicleData) => {
    try {
      const response = await api.post('/simulator/vehicles', vehicleData);
      return response.data;
    } catch (error) {
      console.error('Error adding simulated vehicle:', error);
      throw error;
    }
  },

  /**
   * Control a specific simulated vehicle
   */
  controlVehicle: async (vehicleId, command) => {
    try {
      const response = await api.post(`/simulator/vehicles/${vehicleId}/control`, command);
      return response.data;
    } catch (error) {
      console.error('Error controlling vehicle:', error);
      throw error;
    }
  },

  /**
   * Update simulator settings
   */
  updateSettings: async (settings) => {
    try {
      const response = await api.put('/simulator/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Error updating simulator settings:', error);
      throw error;
    }
  },

  /**
   * Get vehicle location history
   */
  getVehicleHistory: async (vehicleId, limit = 20) => {
    try {
      const response = await api.get(`/simulator/vehicles/${vehicleId}/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicle history:', error);
      throw error;
    }
  },

  /**
   * Create a test vehicle for simulation
   */
  createTestVehicle: async (name = 'Test Vehicle', type = 'car') => {
    const testVehicle = {
      name,
      deviceId: `TEST_${Date.now()}`,
      plateNumber: `TEST-${Math.floor(Math.random() * 1000)}`,
      type,
      driver: {
        name: 'Test Driver',
        phone: '+254700000000'
      },
      company: 'Test Company',
      lat: -1.2921,
      lng: 36.8219
    };
    
    return simulatorApi.addSimulatedVehicle(testVehicle);
  },

  /**
   * Run a complete test sequence
   */
  runTestSequence: async () => {
    console.log('Starting simulator test sequence...');
    
    try {
      // 1. Start simulator
      const startResult = await simulatorApi.startSimulator();
      console.log('Simulator started:', startResult);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 2. Get simulator status
      const status = await simulatorApi.getStatus();
      console.log('Simulator status:', status);
      
      // 3. Get simulated vehicles
      const vehicles = await simulatorApi.getSimulatedVehicles();
      console.log('Simulated vehicles:', vehicles.count);
      
      // 4. Trigger manual location update
      const locationResult = await simulatorApi.triggerLocationUpdates();
      console.log('Location updates triggered:', locationResult);
      
      // 5. Create a test vehicle
      const testVehicle = await simulatorApi.createTestVehicle();
      console.log('Test vehicle created:', testVehicle);
      
      // 6. Control the test vehicle
      if (testVehicle.success && testVehicle.vehicle) {
        const controlResult = await simulatorApi.controlVehicle(testVehicle.vehicle._id, {
          action: 'set_status',
          status: 'active'
        });
        console.log('Vehicle controlled:', controlResult);
      }
      
      // 7. Update simulator settings
      const settingsResult = await simulatorApi.updateSettings({
        updateInterval: 15000 // 15 seconds
      });
      console.log('Settings updated:', settingsResult);
      
      return {
        success: true,
        steps: {
          start: startResult,
          status,
          vehicles,
          locationUpdate: locationResult,
          testVehicle,
          settings: settingsResult
        },
        message: 'Simulator test sequence completed successfully'
      };
      
    } catch (error) {
      console.error('Simulator test sequence failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Simulator test sequence failed'
      };
    }
  }
};

// ==================== Health & Stats API ====================
export const healthApi = {
  /**
   * Get server health status
   */
  getHealth: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Error fetching health status:', error);
      throw error;
    }
  },

  /**
   * Get socket connection statistics
   */
  getSocketStats: async () => {
    try {
      const response = await api.get('/socket/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching socket stats:', error);
      throw error;
    }
  },

  /**
   * Get zone statistics
   */
  getZoneStats: async () => {
    try {
      const response = await api.get('/zones/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching zone stats:', error);
      throw error;
    }
  },

  /**
   * Get system status summary
   */
  getSystemStatus: async () => {
    try {
      const [health, socketStats, zoneStats] = await Promise.all([
        healthApi.getHealth(),
        healthApi.getSocketStats(),
        healthApi.getZoneStats()
      ]);
      
      return {
        server: health,
        sockets: socketStats,
        zones: zoneStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching system status:', error);
      throw error;
    }
  }
};

// ==================== WebSocket Setup ====================
export const setupWebSocket = (options = {}) => {
  const {
    onLocationUpdate,
    onZoneEvent,
    onViolation,
    onVehicleUpdate,
    onPoiSynced,
    onConnect,
    onDisconnect,
    onError,
    onSimulatorStatus,
    onAdminAlert
  } = options;

  const socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log('WebSocket connected to:', WS_URL);
    onConnect?.();
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
        case 'violation:alert':
          onViolation?.(data);
          break;
        case 'vehicle:update':
        case 'vehicle:synced':
          onVehicleUpdate?.(data);
          break;
        case 'poi:odoo:synced':
        case 'poi:created':
        case 'poi:updated':
          onPoiSynced?.(data);
          break;
        case 'simulator:status':
        case 'simulator:started':
        case 'simulator:stopped':
          onSimulatorStatus?.(data);
          break;
        case 'admin:alert':
        case 'system:message':
          onAdminAlert?.(data);
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
    onError?.(error);
  };

  socket.onclose = (event) => {
    console.log('WebSocket disconnected:', event.code, event.reason);
    onDisconnect?.(event);
  };

  // Helper methods
  const sendMessage = (type, data) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, ...data }));
      return true;
    }
    console.warn('WebSocket not connected');
    return false;
  };

  const subscribeToVehicle = (vehicleId) => {
    return sendMessage('subscribe', { channel: `vehicle:${vehicleId}` });
  };

  const unsubscribeFromVehicle = (vehicleId) => {
    return sendMessage('unsubscribe', { channel: `vehicle:${vehicleId}` });
  };

  const subscribeToZone = (zoneId) => {
    return sendMessage('subscribe', { channel: `zone:${zoneId}` });
  };

  const unsubscribeFromZone = (zoneId) => {
    return sendMessage('unsubscribe', { channel: `zone:${zoneId}` });
  };

  const subscribeToSimulator = () => {
    return sendMessage('subscribe', { channel: 'simulator:updates' });
  };

  const unsubscribeFromSimulator = () => {
    return sendMessage('unsubscribe', { channel: 'simulator:updates' });
  };

  const subscribeToViolations = () => {
    return sendMessage('subscribe', { channel: 'violations:alerts' });
  };

  const unsubscribeFromViolations = () => {
    return sendMessage('unsubscribe', { channel: 'violations:alerts' });
  };

  return {
    socket,
    sendMessage,
    subscribeToVehicle,
    unsubscribeFromVehicle,
    subscribeToZone,
    unsubscribeFromZone,
    subscribeToSimulator,
    unsubscribeFromSimulator,
    subscribeToViolations,
    unsubscribeFromViolations,
    close: () => socket.close(),
    isConnected: () => socket.readyState === WebSocket.OPEN
  };
};

// ==================== Configuration Helper ====================
export const config = {
  getApiBaseUrl: () => API_BASE,
  getWebSocketUrl: () => WS_URL,
  
  // Helper to load configuration from .env file or defaults
  loadConfig: () => {
    return {
      apiBaseUrl: API_BASE,
      webSocketUrl: WS_URL,
      isProduction: process.env.NODE_ENV === 'production',
      isDevelopment: process.env.NODE_ENV === 'development'
    };
  }
};

// Export all APIs
export default {
  vehicleApi,
  locationApi,
  odooApi,
  geofenceApi,
  poiApi,
  zoneApi,
  simulatorApi,
  healthApi,
  setupWebSocket,
  config,
  api // Raw axios instance for custom requests
};

// Example React component usage with simulator:
/*
import React, { useEffect, useState } from 'react';
import { vehicleApi, simulatorApi, setupWebSocket, config } from './react-examples';

function Dashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [simulatorStatus, setSimulatorStatus] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);

  useEffect(() => {
    // Load configuration
    const { apiBaseUrl, webSocketUrl } = config.loadConfig();
    console.log('Connected to:', apiBaseUrl);
    console.log('WebSocket:', webSocketUrl);

    // Load vehicles
    vehicleApi.getVehicles().then(data => setVehicles(data.data));
    
    // Load simulator status
    simulatorApi.getStatus().then(status => setSimulatorStatus(status));
    
    // Setup WebSocket for real-time updates
    const ws = setupWebSocket({
      onLocationUpdate: (data) => {
        console.log('Location update:', data);
        // Update your state with real-time data
        setVehicles(prev => {
          const updated = [...prev];
          const index = updated.findIndex(v => v.vehicleId === data.vehicleId);
          if (index >= 0) {
            updated[index] = { ...updated[index], ...data };
          } else {
            updated.push(data);
          }
          return updated;
        });
      },
      onViolation: (data) => {
        alert(`Violation detected: ${data.reason}`);
        // Show notification in your UI
      },
      onSimulatorStatus: (data) => {
        console.log('Simulator status update:', data);
        setSimulatorStatus(prev => ({ ...prev, ...data }));
      },
      onConnect: () => {
        console.log('Real-time updates connected');
        // Subscribe to simulator updates
        ws.subscribeToSimulator();
        ws.subscribeToViolations();
      },
      onDisconnect: () => {
        console.log('Real-time updates disconnected');
        // Show reconnection message
      }
    });
    
    setWsConnection(ws);
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);
  
  const handleStartSimulator = async () => {
    try {
      const result = await simulatorApi.startSimulator();
      console.log('Simulator started:', result);
      setSimulatorStatus(result.status);
    } catch (error) {
      console.error('Failed to start simulator:', error);
    }
  };
  
  const handleRunTestSequence = async () => {
    const result = await simulatorApi.runTestSequence();
    console.log('Test sequence result:', result);
    if (result.success) {
      alert('Simulator test completed successfully!');
    } else {
      alert('Simulator test failed: ' + result.error);
    }
  };
  
  return (
    <div>
      <h1>Vehicle Telematics Dashboard</h1>
      
      <div className="status-panel">
        <h2>System Status</h2>
        <p>Total vehicles: {vehicles.length}</p>
        <p>WebSocket: {wsConnection?.isConnected() ? 'Connected' : 'Disconnected'}</p>
        <p>Simulator: {simulatorStatus?.isRunning ? 'Running' : 'Stopped'}</p>
        {simulatorStatus && (
          <div>
            <p>Update interval: {simulatorStatus.updateInterval / 1000}s</p>
            <p>Requests: {simulatorStatus.requestCount}</p>
            <p>Errors: {simulatorStatus.errorCount}</p>
          </div>
        )}
      </div>
      
      <div className="simulator-controls">
        <h2>Simulator Controls</h2>
        <button onClick={handleStartSimulator}>
          Start Simulator
        </button>
        <button onClick={() => simulatorApi.stopSimulator()}>
          Stop Simulator
        </button>
        <button onClick={handleRunTestSequence}>
          Run Test Sequence
        </button>
        <button onClick={() => simulatorApi.triggerLocationUpdates()}>
          Trigger Location Update
        </button>
      </div>
      
      <div className="vehicles-list">
        <h2>Vehicles</h2>
        {vehicles.map(vehicle => (
          <div key={vehicle._id} className="vehicle-card">
            <h3>{vehicle.name}</h3>
            <p>Plate: {vehicle.licensePlate}</p>
            <p>Status: {vehicle.status}</p>
            {vehicle.lastLocation && (
              <p>
                Location: {vehicle.lastLocation.latitude.toFixed(6)}, 
                {vehicle.lastLocation.longitude.toFixed(6)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Simulator development panel component:
function SimulatorDevPanel() {
  const [simulatedVehicles, setSimulatedVehicles] = useState([]);
  const [isSimulatorRunning, setIsSimulatorRunning] = useState(false);
  
  useEffect(() => {
    // Load simulated vehicles
    simulatorApi.getSimulatedVehicles().then(data => {
      setSimulatedVehicles(data.vehicles || []);
    });
    
    // Check simulator status
    simulatorApi.getStatus().then(status => {
      setIsSimulatorRunning(status.isRunning || status.running);
    });
  }, []);
  
  const handleAddTestVehicle = async () => {
    const result = await simulatorApi.createTestVehicle(
      `Test Vehicle ${simulatedVehicles.length + 1}`,
      'truck'
    );
    
    if (result.success) {
      // Refresh vehicle list
      const vehicles = await simulatorApi.getSimulatedVehicles();
      setSimulatedVehicles(vehicles.vehicles || []);
    }
  };
  
  const handleControlVehicle = async (vehicleId, command) => {
    const result = await simulatorApi.controlVehicle(vehicleId, command);
    console.log('Control result:', result);
    
    // Refresh vehicle list
    const vehicles = await simulatorApi.getSimulatedVehicles();
    setSimulatedVehicles(vehicles.vehicles || []);
  };
  
  return (
    <div className="simulator-dev-panel">
      <h3>Simulator Development Panel</h3>
      
      <div className="controls">
        <button onClick={() => isSimulatorRunning ? 
          simulatorApi.stopSimulator() : simulatorApi.startSimulator()}>
          {isSimulatorRunning ? 'Stop' : 'Start'} Simulator
        </button>
        <button onClick={handleAddTestVehicle}>
          Add Test Vehicle
        </button>
        <button onClick={() => simulatorApi.triggerLocationUpdates()}>
          Send Location Updates
        </button>
      </div>
      
      <div className="simulated-vehicles">
        <h4>Simulated Vehicles ({simulatedVehicles.length})</h4>
        {simulatedVehicles.map(vehicle => (
          <div key={vehicle.id} className="sim-vehicle">
            <strong>{vehicle.name}</strong> ({vehicle.deviceId})
            <div>
              Status: 
              <select 
                value={vehicle.status}
                onChange={(e) => handleControlVehicle(vehicle.id, {
                  action: 'set_status',
                  status: e.target.value
                })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div>
              Location: {vehicle.currentLocation?.lat?.toFixed(6)}, 
              {vehicle.currentLocation?.lng?.toFixed(6)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// In your .env file for React:
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5000

// Or for production:
REACT_APP_API_URL=https://your-domain.com/api
REACT_APP_WS_URL=wss://your-domain.com
*/