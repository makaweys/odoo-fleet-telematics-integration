// lib/socket.js - Vehicle Telematics Socket.io Configuration
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');

let io;
const activeConnections = new Map();
const trackedVehicles = new Map();

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

  io.use(async (socket, next) => {
    try {
      const deviceToken = socket.handshake.query.deviceToken;
      const userToken = socket.handshake.auth.token || 
                       socket.handshake.headers.authorization?.split(' ')[1];
      
      if (deviceToken) {
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
    
    if (socket.connectionType === 'device') {
      handleDeviceConnection(socket);
    }
    
    if (socket.connectionType === 'user') {
      handleUserConnection(socket);
    }
    
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });
    
    socket.on('disconnect', (reason) => {
      handleDisconnect(socket, reason);
    });
    
    socket.on('error', (error) => {
      console.error(`Socket error ${socket.id}:`, error);
    });
  });

  console.log("Vehicle Telematics Socket.io ready");
  return io;
}

function handleDeviceConnection(socket) {
  socket.join(`vehicle:${socket.vehicleId}`);
  socket.join(`device:${socket.deviceId}`);
  
  io.emit('vehicle:status', {
    vehicleId: socket.vehicleId,
    deviceId: socket.deviceId,
    status: 'online',
    lastSeen: new Date()
  });
  
  socket.on('location:update', (locationData) => {
    const enhancedData = {
      ...locationData,
      vehicleId: socket.vehicleId,
      deviceId: socket.deviceId,
      vehicleName: socket.vehicleName,
      timestamp: new Date()
    };
    
    io.to(`vehicle:${socket.vehicleId}`).emit('vehicle:location', enhancedData);
    
    if (trackedVehicles.has(socket.vehicleId)) {
      trackedVehicles.get(socket.vehicleId).forEach(userSocketId => {
        io.to(userSocketId).emit('tracked:vehicle:location', enhancedData);
      });
    }
    
    console.log(`Location update for ${socket.vehicleName}: Lat: ${locationData.latitude}, Lon: ${locationData.longitude}`);
  });
  
  socket.on('violation:alert', (violationData) => {
    const alert = {
      ...violationData,
      vehicleId: socket.vehicleId,
      vehicleName: socket.vehicleName,
      timestamp: new Date(),
      type: 'violation'
    };
    
    io.to('admin:room').emit('violation:detected', alert);
    console.log(`Violation alert for ${socket.vehicleName}: ${violationData.type}`);
  });
  
  socket.on('geofence:event', (eventData) => {
    const event = {
      ...eventData,
      vehicleId: socket.vehicleId,
      vehicleName: socket.vehicleName,
      timestamp: new Date()
    };
    
    io.to('admin:room').emit('geofence:activity', event);
    io.to(`vehicle:${socket.vehicleId}`).emit('geofence:update', event);
  });
}

function handleUserConnection(socket) {
  if (!activeConnections.has(socket.userId)) {
    activeConnections.set(socket.userId, {
      socketId: socket.id,
      role: socket.userRole,
      email: socket.userEmail,
      vehicleIds: new Set(),
      connectedAt: new Date()
    });
  }
  
  socket.join(`user:${socket.userId}`);
  
  if (socket.userRole === 'admin' || socket.userRole === 'manager') {
    socket.join('admin:room');
    socket.join('dashboard:updates');
    console.log(`Admin ${socket.userEmail} joined admin room`);
  }
  
  if (socket.companyId) {
    socket.join(`company:${socket.companyId}`);
  }
  
  socket.on('track:vehicle', (vehicleIds) => {
    if (!Array.isArray(vehicleIds)) vehicleIds = [vehicleIds];
    
    const userConn = activeConnections.get(socket.userId);
    vehicleIds.forEach(vehicleId => {
      socket.join(`vehicle:${vehicleId}`);
      userConn.vehicleIds.add(vehicleId);
      
      if (!trackedVehicles.has(vehicleId)) {
        trackedVehicles.set(vehicleId, []);
      }
      trackedVehicles.get(vehicleId).push(socket.id);
      
      console.log(`User ${socket.userEmail} tracking vehicle ${vehicleId}`);
    });
  });
  
  socket.on('untrack:vehicle', (vehicleIds) => {
    if (!Array.isArray(vehicleIds)) vehicleIds = [vehicleIds];
    
    const userConn = activeConnections.get(socket.userId);
    vehicleIds.forEach(vehicleId => {
      socket.leave(`vehicle:${vehicleId}`);
      userConn.vehicleIds.delete(vehicleId);
      
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
  
  socket.on('subscribe:dashboard', () => {
    socket.join('dashboard:realtime');
    console.log(`User ${socket.userEmail} subscribed to dashboard updates`);
    
    socket.emit('dashboard:init', {
      timestamp: new Date(),
      message: 'Subscribed to real-time updates'
    });
  });
  
  socket.on('subscribe:violations', () => {
    socket.join('violations:alerts');
    console.log(`User ${socket.userEmail} subscribed to violation alerts`);
  });
  
  socket.on('vehicle:command', async (commandData) => {
    const { vehicleId, command, parameters } = commandData;
    
    const canSendCommand = await checkCommandPermission(socket.userId, vehicleId);
    
    if (!canSendCommand) {
      socket.emit('command:error', {
        vehicleId,
        error: 'Permission denied',
        timestamp: new Date()
      });
      return;
    }
    
    io.to(`vehicle:${vehicleId}`).emit('device:command', {
      command,
      parameters,
      issuedBy: socket.userId,
      timestamp: new Date()
    });
    
    console.log(`Command sent to vehicle ${vehicleId}: ${command}`);
    
    socket.emit('command:sent', {
      vehicleId,
      command,
      timestamp: new Date()
    });
  });
}

function handleDisconnect(socket, reason) {
  console.log(`${socket.connectionType} disconnected: ${socket.id} | Reason: ${reason}`);
  
  if (socket.connectionType === 'device') {
    io.emit('vehicle:status', {
      vehicleId: socket.vehicleId,
      deviceId: socket.deviceId,
      status: 'offline',
      lastSeen: new Date()
    });
    
    console.log(`Vehicle ${socket.vehicleName} is now offline`);
  }
  
  if (socket.connectionType === 'user') {
    const userConn = activeConnections.get(socket.userId);
    if (userConn) {
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
      console.log(`User ${socket.userEmail} disconnected`);
    }
  }
}

async function checkCommandPermission(userId, vehicleId) {
  try {
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

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket first.");
  }
  return io;
}

function sendViolationAlert(violationData) {
  if (!io) return;
  
  const alert = {
    ...violationData,
    id: Date.now().toString(),
    timestamp: new Date(),
    read: false
  };
  
  io.to('admin:room').emit('violation:alert', alert);
  io.to('violations:alerts').emit('violation:new', alert);
  
  if (violationData.vehicleId) {
    io.to(`vehicle:${violationData.vehicleId}`).emit('vehicle:violation', alert);
  }
  
  return alert;
}

function broadcastVehicleLocation(vehicleId, locationData) {
  if (!io) return;
  
  io.to(`vehicle:${vehicleId}`).emit('vehicle:location', {
    ...locationData,
    timestamp: new Date()
  });
  
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

function updateDashboardMetrics(metrics) {
  if (!io) return;
  
  io.to('dashboard:updates').emit('dashboard:metrics', {
    ...metrics,
    timestamp: new Date()
  });
}

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