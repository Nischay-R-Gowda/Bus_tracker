const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { authenticate } = require("../middleware/auth");
const { adminOnly, driverOnly, anyAuth } = require("../middleware/roleCheck");

// ==================== CREATE BUS (Admin only) ====================
// POST /api/buses

router.post("/", authenticate, adminOnly, (req, res) => {
  try {
    const { busNumber, registration, routeName, driverId } = req.body;

    if (!busNumber) {
      return res.status(400).json({ message: "Bus number is required." });
    }

    // Check if bus number already exists
    const existing = db.getBusByIdNumber(busNumber);
    if (existing) {
      return res.status(409).json({ message: "Bus with this number already exists." });
    }

    // If driverId is provided, verify the driver exists
    if (driverId) {
      const driver = db.findUserById(driverId);
      if (!driver || driver.role !== "DRIVER") {
        return res.status(400).json({ message: "Invalid driver ID. Driver not found." });
      }
    }

    const busId = db.createBus({
      busNumber,
      registration: registration || null,
      routeName: routeName || null,
      driverId: driverId || null,
    });

    const bus = db.getBusById(busId);

    res.status(201).json({
      message: "Bus created successfully.",
      bus,
    });
  } catch (err) {
    console.error("Create bus error:", err);
    res.status(500).json({ message: "Server error while creating bus." });
  }
});

// ==================== GET ALL BUSES ====================
// GET /api/buses

router.get("/", authenticate, anyAuth, (req, res) => {
  try {
    const buses = db.getAllBuses();

    // For students, only show buses assigned to them (if we had student-bus assignments)
    // For now, all authenticated users can see all buses
    res.json({ buses });
  } catch (err) {
    console.error("Get buses error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== GET BUS BY ID ====================
// GET /api/buses/:id

router.get("/:id", authenticate, anyAuth, (req, res) => {
  try {
    const bus = db.getBusById(parseInt(req.params.id));
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }
    res.json({ bus });
  } catch (err) {
    console.error("Get bus error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== UPDATE BUS (Admin only) ====================
// PUT /api/buses/:id

router.put("/:id", authenticate, adminOnly, (req, res) => {
  try {
    const busId = parseInt(req.params.id);
    const bus = db.getBusById(busId);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    const { busNumber, registration, routeName, status, driverId } = req.body;
    const updates = {};

    if (busNumber !== undefined) updates.busNumber = busNumber;
    if (registration !== undefined) updates.registration = registration;
    if (routeName !== undefined) updates.routeName = routeName;
    if (status !== undefined) updates.status = status;

    if (driverId !== undefined) {
      if (driverId === null) {
        updates.driverId = null;
      } else {
        const driver = db.findUserById(driverId);
        if (!driver || driver.role !== "DRIVER") {
          return res.status(400).json({ message: "Invalid driver ID." });
        }
        updates.driverId = driverId;
      }
    }

    const updatedBus = db.updateBus(busId, updates);

    res.json({
      message: "Bus updated successfully.",
      bus: updatedBus,
    });
  } catch (err) {
    console.error("Update bus error:", err);
    res.status(500).json({ message: "Server error while updating bus." });
  }
});

// ==================== DELETE BUS (Admin only) ====================
// DELETE /api/buses/:id

router.delete("/:id", authenticate, adminOnly, (req, res) => {
  try {
    const busId = parseInt(req.params.id);
    const bus = db.getBusById(busId);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    // Check if there's an active trip
    const activeTrip = db.getActiveTripByBus(busId);
    if (activeTrip) {
      return res.status(400).json({
        message: "Cannot delete bus with an active trip. End the trip first."
      });
    }

    // For a JSON DB, we filter out the bus from the array
    db.data.buses = db.data.buses.filter(b => b.id !== busId);
    db._save();

    res.json({ message: "Bus deleted successfully." });
  } catch (err) {
    console.error("Delete bus error:", err);
    res.status(500).json({ message: "Server error while deleting bus." });
  }
});

// ==================== GET DRIVER'S BUSES ====================
// GET /api/buses/driver/my-buses

router.get("/driver/my-buses", authenticate, driverOnly, (req, res) => {
  try {
    const raw = db.getBusesByDriver(req.user.id);
    const buses = raw.map(bus => {
      const driver = bus.driverId ? db.findUserById(bus.driverId) : null;
      return { ...bus, driverName: driver ? driver.name : null, driverPhone: driver ? driver.phone : null };
    });
    res.json({ buses });
  } catch (err) {
    console.error("Get driver buses error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
