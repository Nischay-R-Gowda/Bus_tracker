const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { authenticate } = require("../middleware/auth");
const { validateCoordinates, calculateDistance } = require("../utils/gps");

// ==================== UPDATE LOCATION (Driver only) ====================
// POST /api/location/update

router.post("/update", authenticate, (req, res) => {
  try {
    const { busId, latitude, longitude, speed, heading, accuracy, timestamp } = req.body;

    // Validate coordinates
    const coordValidation = validateCoordinates(latitude, longitude);
    if (!coordValidation.valid) {
      return res.status(400).json({ message: coordValidation.message });
    }

    // Verify bus exists
    const bus = db.getBusById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    // Verify the driver has an active trip on this bus (or is admin)
    if (req.user.role !== "ADMIN") {
      const activeTrip = db.getActiveTripByBus(busId);
      if (!activeTrip || activeTrip.driverId !== req.user.id) {
        return res.status(403).json({
          message: "You are not authorized to update this bus's location. You must have an active trip on this bus."
        });
      }
    }

    // Verify there's an active trip for this bus
    const activeTrip = db.getActiveTripByBus(busId);
    if (!activeTrip) {
      return res.status(400).json({
        message: "No active trip for this bus. Start a trip first."
      });
    }

    // Get previous location for distance check
    const prevLocation = db.getLatestLocation(busId);

    // Distance-based throttling check
    if (prevLocation) {
      const distance = calculateDistance(
        prevLocation.latitude,
        prevLocation.longitude,
        latitude,
        longitude
      );

      // If distance is less than 10 meters, it's likely GPS jitter — still save but note it
      if (distance < 10) {
        console.log(`Small GPS movement detected: ${distance.toFixed(2)}m — saving but may be jitter`);
      }
    }

    // Save location
    const locationId = db.saveLocation({
      busId,
      latitude,
      longitude,
      speed: speed || null,
      heading: heading || null,
      accuracy: accuracy || null,
      timestamp: timestamp || new Date().toISOString(),
    });

    const savedLocation = db.getLocationHistory(busId, 1)[0];

    // Broadcast location to students via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`bus-${busId}`).emit("location:update", {
        busId,
        ...savedLocation,
      });
    }

    res.status(201).json({
      message: "Location updated.",
      location: savedLocation,
    });
  } catch (err) {
    console.error("Location update error:", err);
    res.status(500).json({ message: "Server error while updating location." });
  }
});

// ==================== GET LATEST LOCATION ====================
// GET /api/location/:busId

router.get("/:busId", authenticate, (req, res) => {
  try {
    const busId = parseInt(req.params.busId);

    // Verify bus exists
    const bus = db.getBusById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    const location = db.getLatestLocation(busId);
    if (!location) {
      return res.status(404).json({
        message: "No location data available for this bus.",
        bus: { id: bus.id, busNumber: bus.busNumber, status: bus.status },
      });
    }

    // Calculate how old the location is
    const locationTime = new Date(location.timestamp);
    const now = new Date();
    const ageSeconds = Math.floor((now - locationTime) / 1000);

    let freshnessStatus = "LIVE";
    if (ageSeconds > 60) freshnessStatus = "STALE";
    else if (ageSeconds > 30) freshnessStatus = "AGING";

    res.json({
      location,
      bus: { id: bus.id, busNumber: bus.busNumber, status: bus.status },
      freshness: {
        status: freshnessStatus,
        ageSeconds,
        ageText: ageSeconds < 60 ? `${ageSeconds} seconds ago` : `${Math.floor(ageSeconds / 60)} minutes ago`,
      },
    });
  } catch (err) {
    console.error("Get location error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== GET LOCATION HISTORY ====================
// GET /api/location/:busId/history

router.get("/:busId/history", authenticate, (req, res) => {
  try {
    const busId = parseInt(req.params.busId);
    const limit = parseInt(req.query.limit) || 50;

    const bus = db.getBusById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    const history = db.getLocationHistory(busId, limit);

    res.json({
      history,
      count: history.length,
      bus: { id: bus.id, busNumber: bus.busNumber },
    });
  } catch (err) {
    console.error("Get location history error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
