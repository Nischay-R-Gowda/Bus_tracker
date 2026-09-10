const express = require("express");
const router = express.Router();
const db = require("../database/db");

// ==================== PUBLIC: GET ALL BUSES (no auth) ====================
// GET /api/public/buses

router.get("/buses", (req, res) => {
  try {
    const buses = db.getAllBuses();
    res.json({ buses });
  } catch (err) {
    console.error("Get public buses error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== PUBLIC: GET BUS BY ID (no auth) ====================
// GET /api/public/buses/:id

router.get("/buses/:id", (req, res) => {
  try {
    const bus = db.getBusById(parseInt(req.params.id));
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }
    res.json({ bus });
  } catch (err) {
    console.error("Get public bus error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== PUBLIC: GET LATEST LOCATION (no auth) ====================
// GET /api/public/location/:busId

router.get("/location/:busId", (req, res) => {
  try {
    const busId = parseInt(req.params.busId);
    const bus = db.getBusById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    const location = db.getLatestLocation(busId);
    const trip = db.getActiveTripByBus(busId);

    if (!location) {
      return res.json({
        location: null,
        bus: { id: bus.id, busNumber: bus.busNumber, routeName: bus.routeName, status: bus.status },
        freshness: { status: "NO_DATA", message: "No location data available yet." },
      });
    }

    const now = new Date();
    const updatedAt = new Date(location.timestamp);
    const ageSeconds = Math.floor((now - updatedAt) / 1000);

    let freshnessStatus = "LIVE";
    let freshnessMessage = "Location is live.";
    if (ageSeconds > 60) {
      freshnessStatus = "STALE";
      freshnessMessage = `Location is ${Math.floor(ageSeconds / 60)} min old. May no longer be live.`;
    } else if (ageSeconds > 30) {
      freshnessStatus = "AGING";
      freshnessMessage = `Last updated ${ageSeconds} seconds ago.`;
    }

    res.json({
      location,
      bus: { id: bus.id, busNumber: bus.busNumber, routeName: bus.routeName, status: bus.status },
      freshness: { status: freshnessStatus, message: freshnessMessage, ageSeconds },
      trip: trip ? { id: trip.id, status: trip.status, startTime: trip.startTime } : null,
    });
  } catch (err) {
    console.error("Get public location error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== PUBLIC: GET LOCATION HISTORY (no auth) ====================
// GET /api/public/location/:busId/history

router.get("/location/:busId/history", (req, res) => {
  try {
    const busId = parseInt(req.params.busId);
    const bus = db.getBusById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    const limit = parseInt(req.query.limit) || 50;
    const history = db.getLocationHistory(busId, limit);

    res.json({ history, count: history.length });
  } catch (err) {
    console.error("Get public location history error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== PUBLIC: GET ACTIVE TRIPS (no auth) ====================
// GET /api/public/trips/active

router.get("/trips/active", (req, res) => {
  try {
    const trips = db.getAllTrips().filter(t => t.status === "ACTIVE");
    res.json({ trips });
  } catch (err) {
    console.error("Get public active trips error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== PUBLIC: GET ALL ROUTES (no auth) ====================
// GET /api/public/routes

router.get("/routes", (req, res) => {
  try {
    const routes = db.getAllRoutes();
    res.json({ routes });
  } catch (err) {
    console.error("Get public routes error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
