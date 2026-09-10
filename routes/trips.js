const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { authenticate } = require("../middleware/auth");
const { driverOnly, adminOnly, anyAuth } = require("../middleware/roleCheck");

// ==================== START TRIP (Driver only) ====================
// POST /api/trips/start

router.post("/start", authenticate, driverOnly, (req, res) => {
  try {
    const { busId } = req.body;

    if (!busId) {
      return res.status(400).json({ message: "Bus ID is required." });
    }

    const bus = db.getBusById(parseInt(busId));
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    // Check if bus already has an active trip
    const existingTrip = db.getActiveTripByBus(parseInt(busId));
    if (existingTrip) {
      return res.status(400).json({
        message: "This bus already has an active trip."
      });
    }

    // Check if driver already has an active trip on another bus
    const driverActiveTrip = db.getActiveTripByDriver(req.user.id);
    if (driverActiveTrip) {
      return res.status(400).json({
        message: "You already have an active trip. End it before starting a new one."
      });
    }

    // Create trip — no permanent driver-bus assignment required
    const tripId = db.createTrip({ busId: parseInt(busId), driverId: req.user.id });

    // Update bus status
    db.updateBus(parseInt(busId), { status: "ACTIVE" });

    const trip = db.getActiveTripByBus(parseInt(busId));

    // Broadcast trip started to students watching this bus
    const io = req.app.get("io");
    if (io) {
      io.to(`bus-${busId}`).emit("trip:status", { busId, status: "STARTED", trip });
    }

    res.status(201).json({
      message: "Trip started successfully.",
      trip,
    });
  } catch (err) {
    console.error("Start trip error:", err);
    res.status(500).json({ message: "Server error while starting trip." });
  }
});

// ==================== STOP TRIP (Driver only) ====================
// POST /api/trips/stop

router.post("/stop", authenticate, driverOnly, (req, res) => {
  try {
    // Find driver's active trip
    const trip = db.getActiveTripByDriver(req.user.id);

    if (!trip) {
      return res.status(400).json({ message: "No active trip found." });
    }

    const busId = trip.busId;

    // End the trip
    db.endTrip(trip.id);

    // Update bus status
    db.updateBus(busId, { status: "INACTIVE" });

    // Broadcast trip ended to students watching this bus
    const io = req.app.get("io");
    if (io) {
      io.to(`bus-${busId}`).emit("trip:status", { busId, status: "ENDED" });
    }

    res.json({
      message: "Trip ended successfully.",
      tripId: trip.id,
    });
  } catch (err) {
    console.error("Stop trip error:", err);
    res.status(500).json({ message: "Server error while ending trip." });
  }
});

// ==================== GET ACTIVE TRIPS ====================
// GET /api/trips/active

router.get("/active", authenticate, anyAuth, (req, res) => {
  try {
    const trips = db.getAllTrips().filter(t => t.status === "ACTIVE");

    res.json({ trips });
  } catch (err) {
    console.error("Get active trips error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== GET ALL TRIPS (Admin only) ====================
// GET /api/trips

router.get("/", authenticate, adminOnly, (req, res) => {
  try {
    const trips = db.getAllTrips();
    res.json({ trips });
  } catch (err) {
    console.error("Get trips error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== GET DRIVER'S ACTIVE TRIP ====================
// GET /api/trips/my-trip

router.get("/my-trip", authenticate, driverOnly, (req, res) => {
  try {
    const trip = db.getActiveTripByDriver(req.user.id);
    if (!trip) {
      return res.json({ trip: null });
    }

    const bus = db.getBusById(trip.busId);
    const latestLocation = db.getLatestLocation(trip.busId);

    res.json({
      trip,
      bus,
      latestLocation,
    });
  } catch (err) {
    console.error("Get my trip error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
