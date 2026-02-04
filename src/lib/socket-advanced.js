// lib/socket.js - Vehicle Telematics Socket.io Configuration
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');

let io;
const activeConnections = new Map(); // Map<userId, {socketId, role, vehicleIds}>
const trackedVehicles = new Map(); // Map<vehicleId, socketId[]> - Who's tracking each vehicle

/**
 * Initialize Socket.io for vehicle telematics
 * @param {http.Server} server - HTTP server instance
 * @returns {socketIO.Server} Initialized Socket.io instance
 */
function initSocket(server) {
  console.log("Initializing Vehicle Telematics Socket.io...");
  
  io = socketIO(server, {
    path: "/api/socket.io",
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.CLIENT_URL.split(',') 
        : ["http://localhost:3000", "http://localhost:5173"],
      credentials: true,
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware for vehicle tracking
  io.use(async (socket, next) => {
    try {
      // For vehicle trackers (from Traccar/device), use device token
      const deviceToken = socket.handshake.query.deviceToken;
      const userToken = socket.handshake.auth.token || 
                       socket.handshake.headers.authorization?.split(' ')[1];
      
      if (deviceToken) {
        // Device connection (from GPS tracker/Traccar)
        // Validate device token (you might have a different validation for devices)
        const vehicle = await Vehicle.findOne({ deviceToken });
        if (!vehicle) {
          return next(new Error('Invalid device token'));
        }
        
        socket.deviceId = vehicle.deviceId;
        socket.vehicleId = vehicle._id.toString();
        socket.vehicleName = vehicle.name;
        socket.connectionType = 'device';
        
        console.log(`Device connected: ${vehicle.name} (${vehicle.deviceId})`);
      } else if (userToken) {
        // User connection (from web/mobile app)
        const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('_id email role isActive company');
        
        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }
        
        socket.userId = user._id.toString();
        socket.userEmail = user.email;
        socket.userRole = user.role;
        socket.companyId = user.company?._id?.toString();
        socket.connectionType = 'user';
        
        console.log(`User connected: ${user.email} (${user.role})`);
      } else {
        return next(new Error('Authentication required'));
      }
      
      next();
    } catch (error) {
      console.error(`Socket auth error:`, error.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on("connection", (socket) => {
    console.log(`New ${socket.connectionType} connection: ${socket.id}`);
    
    // Handle device connections (GPS trackers)
    if (socket.connectionType === 'device') {
      handleDeviceConnection(socket);
    }
    
    // Handle user connections (web/mobile apps)
    if (socket.connectionType === 'user') {
      handleUserConnection(socket);
    }
    
    // Common events for all connections
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });
    
    socket.on('disconnect', (reason) => {
      handleDisconnect(socket, reason);
    });
    
    socket.on('error', (error) => {
      console.error(`💥 Socket error ${socket.id}:`, error);
    });
  });

  console.log("Vehicle Telematics Socket.io ready");
  return io;
}

/**
 * Handle device (GPS tracker) connections
 */
function handleDeviceConnection(socket) {
  // Join vehicle-specific room
  socket.join(`vehicle:${socket.vehicleId}`);
  socket.join(`device:${socket.deviceId}`);
  
  // Notify that this vehicle is now online
  io.emit('vehicle:status', {
    vehicleId: socket.vehicleId,
    deviceId: socket.deviceId,
    status: 'online',
    lastSeen: new Date()
  });
  
  // Forward location updates from device to subscribers
  socket.on('location:update', (locationData) => {
    const enhancedData = {
      ...locationData,
      vehicleId: socket.vehicleId,
      deviceId: socket.deviceId,
      vehicleName: socket.vehicleName,
      timestamp: new Date()
    };
    
    // Broadcast to vehicle room
    io.to(`vehicle:${socket.vehicleId}`).emit('vehicle:location', enhancedData);
    
    // Broadcast to all users tracking this vehicle
    if (trackedVehicles.has(socket.vehicleId)) {
      trackedVehicles.get(socket.vehicleId).forEach(userSocketId => {
        io.to(userSocketId).emit('tracked:vehicle:location', enhancedData);
      });
    }
    
    // Store last known location
    // You might want to save this to database
    console.log(`Location update for ${socket.vehicleName}:`, 
      `Lat: ${locationData.latitude}, Lon: ${locationData.longitude}`);
  });
  
  // Handle violation alerts from device
  socket.on('violation:alert', (violationData) => {
    const alert = {
      ...violationData,
      vehicleId: socket.vehicleId,
      vehicleName: socket.vehicleName,
      timestamp: new Date(),
      type: 'violation'
    };
    
    // Emit to admin room
    io.to('admin:room').emit('violation:detected', alert);
    
    // Store violation (you'll save to database here)
    console.log(`Violation alert for ${socket.vehicleName}:`, violationData.type);
  });
  
  // Handle geofence entry/exit events
  socket.on('geofence:event', (eventData) => {
    const event = {
      ...eventData,
      vehicleId: socket.vehicleId,
      vehicleName: socket.vehicleName,
      timestamp: new Date()
    };
    
    // Emit to admin room and vehicle room
    io.to('admin:room').emit('geofence:activity', event);
    io.to(`vehicle:${socket.vehicleId}`).emit('geofence:update', event);
  });
}

/**
 * Handle user (web/mobile app) connections
 */
function handleUserConnection(socket) {
  // Track user connection
  if (!activeConnections.has(socket.userId)) {
    activeConnections.set(socket.userId, {
      socketId: socket.id,
      role: socket.userRole,
      email: socket.userEmail,
      vehicleIds: new Set(),
      connectedAt: new Date()
    });
  }
  
  // Join user to personal room
  socket.join(`user:${socket.userId}`);
  
  // Join admin room if user is admin
  if (socket.userRole === 'admin' || socket.userRole === 'manager') {
    socket.join('admin:room');
    socket.join('dashboard:updates');
    console.log(`🛡️ Admin ${socket.userEmail} joined admin room`);
  }
  
  // Join company room if user belongs to a company
  if (socket.companyId) {
    socket.join(`company:${socket.companyId}`);
  }
  
  // User wants to track specific vehicles
  socket.on('track:vehicle', (vehicleIds) => {
    if (!Array.isArray(vehicleIds)) vehicleIds = [vehicleIds];
    
    const userConn = activeConnections.get(socket.userId);
    vehicleIds.forEach(vehicleId => {
      // Join vehicle room
      socket.join(`vehicle:${vehicleId}`);
      
      // Add to user's tracked vehicles
      userConn.vehicleIds.add(vehicleId);
      
      // Add user to vehicle's tracker list
      if (!trackedVehicles.has(vehicleId)) {
        trackedVehicles.set(vehicleId, []);
      }
      trackedVehicles.get(vehicleId).push(socket.id);
      
      console.log(`👁️ User ${socket.userEmail} tracking vehicle ${vehicleId}`);
    });
  });
  
  // User wants to stop tracking vehicles
  socket.on('untrack:vehicle', (vehicleIds) => {
    if (!Array.isArray(vehicleIds)) vehicleIds = [vehicleIds];
    
    const userConn = activeConnections.get(socket.userId);
    vehicleIds.forEach(vehicleId => {
      // Leave vehicle room
      socket.leave(`vehicle:${vehicleId}`);
      
      // Remove from user's tracked vehicles
      userConn.vehicleIds.delete(vehicleId);
      
      // Remove user from vehicle's tracker list
      if (trackedVehicles.has(vehicleId)) {
        const index = trackedVehicles.get(vehicleId).indexOf(socket.id);
        if (index > -1) {
          trackedVehicles.get(vehicleId).splice(index, 1);
        }
        if (trackedVehicles.get(vehicleId).length === 0) {
          trackedVehicles.delete(vehicleId);
        }
      }
    });
  });
  
  // User wants real-time dashboard updates
  socket.on('subscribe:dashboard', () => {
    socket.join('dashboard:realtime');
    console.log(`User ${socket.userEmail} subscribed to dashboard updates`);
    
    // Send initial dashboard data
    socket.emit('dashboard:init', {
      timestamp: new Date(),
      message: 'Subscribed to real-time updates'
    });
  });
  
  // User wants violation alerts
  socket.on('subscribe:violations', () => {
    socket.join('violations:alerts');
    console.log(`User ${socket.userEmail} subscribed to violation alerts`);
  });
  
  // User sends command to vehicle (e.g., stop engine, lock doors)
  socket.on('vehicle:command', async (commandData) => {
    const { vehicleId, command, parameters } = commandData;
    
    // Verify user has permission to send commands
    const canSendCommand = await checkCommandPermission(socket.userId, vehicleId);
    
    if (!canSendCommand) {
      socket.emit('command:error', {
        vehicleId,
        error: 'Permission denied',
        timestamp: new Date()
      });
      return;
    }
    
    // Forward command to vehicle
    io.to(`vehicle:${vehicleId}`).emit('device:command', {
      command,
      parameters,
      issuedBy: socket.userId,
      timestamp: new Date()
    });
    
    console.log(`📡 Command sent to vehicle ${vehicleId}: ${command}`);
    
    // Acknowledge to sender
    socket.emit('command:sent', {
      vehicleId,
      command,
      timestamp: new Date()
    });
  });
}

/**
 * Handle disconnection
 */
function handleDisconnect(socket, reason) {
  console.log(`🔌 ${socket.connectionType} disconnected: ${socket.id} | Reason: ${reason}`);
  
  if (socket.connectionType === 'device') {
    // Vehicle went offline
    io.emit('vehicle:status', {
      vehicleId: socket.vehicleId,
      deviceId: socket.deviceId,
      status: 'offline',
      lastSeen: new Date()
    });
    
    console.log(`🚗 Vehicle ${socket.vehicleName} is now offline`);
  }
  
  if (socket.connectionType === 'user') {
    // Clean up user tracking
    const userConn = activeConnections.get(socket.userId);
    if (userConn) {
      // Remove from tracked vehicles
      userConn.vehicleIds.forEach(vehicleId => {
        if (trackedVehicles.has(vehicleId)) {
          const index = trackedVehicles.get(vehicleId).indexOf(socket.id);
          if (index > -1) {
            trackedVehicles.get(vehicleId).splice(index, 1);
          }
          if (trackedVehicles.get(vehicleId).length === 0) {
            trackedVehicles.delete(vehicleId);
          }
        }
      });
      
      activeConnections.delete(socket.userId);
      console.log(`👋 User ${socket.userEmail} disconnected`);
    }
  }
}

/**
 * Check if user has permission to send commands to vehicle
 */
async function checkCommandPermission(userId, vehicleId) {
  try {
    // Implement your permission logic here
    // For example, check if user is admin or owns the vehicle
    const user = await User.findById(userId).select('role company');
    const vehicle = await Vehicle.findById(vehicleId).select('company');
    
    if (user.role === 'admin') return true;
    if (user.company && vehicle.company && 
        user.company.toString() === vehicle.company.toString()) return true;
    
    return false;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * Get the Socket.io instance
 */
function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket first.");
  }
  return io;
}

/**
 * Send violation alert to relevant users
 */
function sendViolationAlert(violationData) {
  if (!io) return;
  
  const alert = {
    ...violationData,
    id: Date.now().toString(),
    timestamp: new Date(),
    read: false
  };
  
  // Send to admin room
  io.to('admin:room').emit('violation:alert', alert);
  
  // Send to users subscribed to violations
  io.to('violations:alerts').emit('violation:new', alert);
  
  // Send to vehicle-specific room
  if (violationData.vehicleId) {
    io.to(`vehicle:${violationData.vehicleId}`).emit('vehicle:violation', alert);
  }
  
  return alert;
}

/**
 * Broadcast vehicle location update
 */
function broadcastVehicleLocation(vehicleId, locationData) {
  if (!io) return;
  
  io.to(`vehicle:${vehicleId}`).emit('vehicle:location', {
    ...locationData,
    timestamp: new Date()
  });
  
  // Notify users tracking this vehicle
  if (trackedVehicles.has(vehicleId)) {
    trackedVehicles.get(vehicleId).forEach(socketId => {
      io.to(socketId).emit('tracked:vehicle:location', {
        vehicleId,
        ...locationData,
        timestamp: new Date()
      });
    });
  }
}

/**
 * Update dashboard metrics in real-time
 */
function updateDashboardMetrics(metrics) {
  if (!io) return;
  
  io.to('dashboard:updates').emit('dashboard:metrics', {
    ...metrics,
    timestamp: new Date()
  });
}

/**
 * Get connection statistics
 */
function getConnectionStats() {
  return {
    totalConnections: io?.engine?.clientsCount || 0,
    activeDevices: Array.from(io?.sockets?.sockets || []).filter(
      ([_, socket]) => socket.connectionType === 'device'
    ).length,
    activeUsers: activeConnections.size,
    trackedVehicles: trackedVehicles.size,
    timestamp: new Date()
  };
}

module.exports = {
  initSocket,
  getIO,
  sendViolationAlert,
  broadcastVehicleLocation,
  updateDashboardMetrics,
  getConnectionStats
};