const express = require("express");
const cors = require("cors");
const http = require("http");
const { initializeSocket, broadcastLocation, broadcastTripStatus } = require("./socket");

const authRoutes = require("./routes/auth");
const busRoutes = require("./routes/buses");
const tripRoutes = require("./routes/trips");
const adminRoutes = require("./routes/admin");
const locationRoutes = require("./routes/location");
const publicRoutes = require("./routes/public");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Make io available to route handlers
app.set("io", io);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static("public"));

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.json({
    message: "Bus Tracker API is running ✓",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth/register, /api/auth/login, /api/auth/me",
      buses: "/api/buses",
      trips: "/api/trips/start, /api/trips/stop, /api/trips/active",
      location: "/api/location/update, /api/location/:busId, /api/location/:busId/history",
    },
  });
});

/* ================= RENDER HEALTH CHECK ================= */

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "college-bus-tracker",
    timestamp: new Date().toISOString()
  });
});

/* ================= API ROUTES ================= */
app.use("/api/auth", authRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

/* ================= ERROR HANDLING ================= */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error." });
});

/* ================= START SERVER ================= */

// Render automatically provides PORT in production.
// Locally, the application uses port 3001.
const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log("\n========================================");
  console.log("  College Bus Live Tracking System");
  console.log("========================================");
  console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`  Server running on port: ${PORT}`);
  console.log(`  Listening on: ${HOST}`);
  console.log("  Socket.IO initialized");
  console.log("========================================\n");
});