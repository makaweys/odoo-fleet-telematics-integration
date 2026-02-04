// socket.js
let io;

function initSocket(server) {
  const socketIO = require("socket.io");
  console.log("Creating Server IO-Socket");
  io = socketIO(server, {
    path: "/api/socket.io", // <-- This is required
    cors: {
      origin: "*", // or restrict to frontend origin
      methods: ["GET", "POST"],
    },
  });

  if (io) {
    console.log("IO Socket Created");
  }

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket first.");
  }
  return io;
}

module.exports = {
  initSocket,
  getIO,
};
