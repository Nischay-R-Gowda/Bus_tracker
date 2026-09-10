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

/* ================= TEST SEED (dev only) ================= */
app.post("/api/test/seed", (req, res) => {
  const db = require("../database/db");
  const bcrypt = require("bcryptjs");
  if (!db.data.routes) db.data.routes = [];
  if (!db.data._counters.routes) db.data._counters.routes = 0;

  // Ensure admin exists
  let admin = db.findUserByEmail("admin@test.com");
  if (!admin) {
    db.data.users.push({
      id: db._nextId("users"), name: "Admin", email: "admin@test.com",
      password: bcrypt.hashSync("admin123", 10), role: "ADMIN", phone: null, status: "ACTIVE",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  }
  // Student
  if (!db.findUserByEmail("student@test.com")) {
    db.data.users.push({
      id: db._nextId("users"), name: "Student", email: "student@test.com",
      password: bcrypt.hashSync("student123", 10), role: "STUDENT", phone: null, status: "ACTIVE",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  }
  // Driver
  if (!db.findUserByEmail("driver@test.com")) {
    db.data.users.push({
      id: db._nextId("users"), name: "Driver Nischay", email: "driver@test.com",
      password: bcrypt.hashSync("driver123", 10), role: "DRIVER", phone: "+919876543210", status: "ACTIVE",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  }
  // Route + stops
  if (db.data.routes.length === 0) {
    const routeId = db._nextId("routes");
    db.data.routes.push({
      id: routeId, name: "Campus to Hostel", description: "Main route",
      stops: [
        { name: "Main Gate", latitude: 12.9350, longitude: 77.5360 },
        { name: "Bus Stop 1", latitude: 12.9370, longitude: 77.5380 },
        { name: "Hostel", latitude: 12.9400, longitude: 77.5400 },
      ],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  }
  // Buses
  if (db.data.buses.length === 0) {
    db.data.buses.push(
      { id: db._nextId("buses"), busNumber: "Bus 01", registration: null, routeName: "Campus to Hostel", status: "INACTIVE", driverId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: db._nextId("buses"), busNumber: "Bus 02", registration: null, routeName: "Campus to Hostel", status: "INACTIVE", driverId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    );
  }
  db._save();
  res.json({ ok: true, users: db.data.users.length, routes: db.data.routes.length, buses: db.data.buses.length });
});

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
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Bus Tracker Server running on port ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
