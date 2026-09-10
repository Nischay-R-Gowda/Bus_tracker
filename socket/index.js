const { Server } = require("socket.io");
const db = require("../database/db");

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} httpServer - The HTTP server instance
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Allow all origins for development
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Driver joins a bus room to broadcast location
    socket.on("driver:join-bus", (busId) => {
      const roomName = `bus-${busId}`;
      socket.join(roomName);
      console.log(`Driver ${socket.id} joined room: ${roomName}`);

      socket.emit("joined", { room: roomName, message: `Broadcasting to ${roomName}` });
    });

    // Driver leaves a bus room
    socket.on("driver:leave-bus", (busId) => {
      const roomName = `bus-${busId}`;
      socket.leave(roomName);
      console.log(`Driver ${socket.id} left room: ${roomName}`);
    });

    // Student joins a bus room to receive location updates
    socket.on("student:join-bus", (busId) => {
      const roomName = `bus-${busId}`;
      socket.join(roomName);
      console.log(`Student ${socket.id} joined room: ${roomName}`);

      // Send the latest known location immediately upon joining
      const latestLocation = db.getLatestLocation(busId);
      if (latestLocation) {
        socket.emit("location:update", {
          busId,
          ...latestLocation,
          isHistorical: true,
        });
      }

      socket.emit("joined", { room: roomName, message: `Tracking ${roomName}` });
    });

    // Student leaves a bus room
    socket.on("student:leave-bus", (busId) => {
      const roomName = `bus-${busId}`;
      socket.leave(roomName);
      console.log(`Student ${socket.id} left room: ${roomName}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.IO server initialized ✓");

  return io;
}

/**
 * Broadcast a location update to all students watching a specific bus
 * @param {number} busId - The bus ID
 * @param {object} locationData - Location data to broadcast
 */
function broadcastLocation(busId, locationData) {
  if (!io) return;
  io.to(`bus-${busId}`).emit("location:update", {
    busId,
    ...locationData,
    isHistorical: false,
  });
  console.log(`Broadcasted location for bus ${busId} to room bus-${busId}`);
}

/**
 * Broadcast a trip status change to all students watching a bus
 * @param {number} busId - The bus ID
 * @param {string} status - Trip status (e.g., "STARTED", "ENDED")
 * @param {object} data - Additional data
 */
function broadcastTripStatus(busId, status, data = {}) {
  if (!io) return;
  io.to(`bus-${busId}`).emit("trip:status", {
    busId,
    status,
    ...data,
  });
}

module.exports = {
  initializeSocket,
  broadcastLocation,
  broadcastTripStatus,
};
