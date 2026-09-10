const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { authenticate } = require("../middleware/auth");
const { adminOnly } = require("../middleware/roleCheck");

// ==================== ADMIN: ROUTE MANAGEMENT ====================

// POST /api/admin/routes — Create route (admin only)
router.post("/routes", authenticate, adminOnly, (req, res) => {
  try {
    const { name, description, stops } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Route name is required." });
    }
    const id = db.createRoute({ name, description, stops });
    const route = db.getRouteById(id);
    res.status(201).json({ message: "Route created successfully.", route });
  } catch (err) {
    console.error("Create route error:", err);
    res.status(500).json({ message: "Server error while creating route." });
  }
});

// GET /api/admin/routes — List all routes (admin only)
router.get("/routes", authenticate, adminOnly, (req, res) => {
  try {
    const routes = db.getAllRoutes();
    res.json({ routes });
  } catch (err) {
    console.error("Get routes error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// PUT /api/admin/routes/:id — Update route (admin only)
router.put("/routes/:id", authenticate, adminOnly, (req, res) => {
  try {
    const routeId = parseInt(req.params.id);
    const route = db.getRouteById(routeId);
    if (!route) return res.status(404).json({ message: "Route not found." });

    const { name, description, stops } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (stops !== undefined) updates.stops = stops;

    const updated = db.updateRoute(routeId, updates);
    res.json({ message: "Route updated successfully.", route: updated });
  } catch (err) {
    console.error("Update route error:", err);
    res.status(500).json({ message: "Server error while updating route." });
  }
});

// DELETE /api/admin/routes/:id — Delete route (admin only)
router.delete("/routes/:id", authenticate, adminOnly, (req, res) => {
  try {
    const routeId = parseInt(req.params.id);
    const route = db.getRouteById(routeId);
    if (!route) return res.status(404).json({ message: "Route not found." });

    const busesUsingRoute = db.getAllBuses().filter(b => b.routeName === route.name);
    if (busesUsingRoute.length > 0) {
      return res.status(400).json({
        message: `Cannot delete route — ${busesUsingRoute.length} bus(es) are assigned to it. Remove those assignments first.`
      });
    }

    db.deleteRoute(routeId);
    res.json({ message: "Route deleted successfully." });
  } catch (err) {
    console.error("Delete route error:", err);
    res.status(500).json({ message: "Server error while deleting route." });
  }
});

module.exports = router;
