const express = require("express");
const router = express.Router();
const db = require("../database/db");
const bcrypt = require("bcryptjs");
const { generateToken, authenticate } = require("../middleware/auth");
const { adminOnly } = require("../middleware/roleCheck");

// POST /api/auth/register
// Public self-registration allowed for STUDENT role only.
// DRIVER and ADMIN accounts must be created by an existing admin.
router.post("/register", (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    // Only allow STUDENT registration publicly
    const finalRole = role ? role.toUpperCase() : "STUDENT";
    if (finalRole === "ADMIN" || finalRole === "DRIVER") {
      return res.status(403).json({ message: "Only student registration is allowed publicly." });
    }
    if (finalRole !== "STUDENT") {
      return res.status(400).json({ message: "Invalid role. Must be STUDENT." });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const userId = db.createUser({
      name, email, password,
      role: "STUDENT",
      phone: phone || null,
    });

    const user = db.findUserById(userId);
    res.status(201).json({
      message: "Student account created. You can now login.",
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, status: user.status },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Check if account is disabled
    if (user.status === "DISABLED") {
      return res.status(403).json({ message: "Your account has been disabled. Please contact the administrator." });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = generateToken(user);
    res.json({
      message: "Login successful.",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, status: user.status },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ user });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== ADMIN: DRIVER MANAGEMENT ====================

// POST /api/auth/drivers — Create driver (admin only)
router.post("/drivers", authenticate, adminOnly, (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const userId = db.createUser({
      name, email, password,
      role: "DRIVER",
      phone: phone || null,
    });

    const user = db.findUserById(userId);
    res.status(201).json({
      message: "Driver account created successfully.",
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, status: user.status },
    });
  } catch (err) {
    console.error("Create driver error:", err);
    res.status(500).json({ message: "Server error while creating driver." });
  }
});

// GET /api/auth/drivers — List all drivers (admin only)
router.get("/drivers", authenticate, adminOnly, (req, res) => {
  try {
    const users = db.getAllUsers().filter(u => u.role === "DRIVER");
    res.json({ drivers: users });
  } catch (err) {
    console.error("Get drivers error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// PUT /api/auth/drivers/:id — Update driver (admin only)
router.put("/drivers/:id", authenticate, adminOnly, (req, res) => {
  try {
    const driverId = parseInt(req.params.id);
    const driver = db.getUserById(driverId);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found." });
    }
    if (driver.role !== "DRIVER") {
      return res.status(400).json({ message: "User is not a driver." });
    }

    const { name, email, phone, password, status } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (password) updates.password = password;
    if (status) updates.status = status.toUpperCase();

    const updated = db.updateUser(driverId, updates);
    res.json({ message: "Driver updated successfully.", user: updated });
  } catch (err) {
    console.error("Update driver error:", err);
    res.status(500).json({ message: "Server error while updating driver." });
  }
});

// DELETE /api/auth/drivers/:id — Delete driver (admin only)
router.delete("/drivers/:id", authenticate, adminOnly, (req, res) => {
  try {
    const driverId = parseInt(req.params.id);
    const driver = db.getUserById(driverId);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found." });
    }
    if (driver.role !== "DRIVER") {
      return res.status(400).json({ message: "User is not a driver." });
    }

    // Check for active trip
    if (db.hasUserActiveTrip(driverId)) {
      return res.status(400).json({
        message: "Cannot delete driver with an active trip. Stop the trip first.",
      });
    }

    db.deleteUser(driverId);
    res.json({ message: "Driver deleted successfully." });
  } catch (err) {
    console.error("Delete driver error:", err);
    res.status(500).json({ message: "Server error while deleting driver." });
  }
});

// ==================== ADMIN: BUS MANAGEMENT ====================

// DELETE /api/auth/buses/:id — Delete bus (admin only)
router.delete("/buses/:id", authenticate, adminOnly, (req, res) => {
  try {
    const busId = parseInt(req.params.id);
    const bus = db.getBusById(busId);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    // Check for active trip
    if (db.hasActiveTrip(busId)) {
      return res.status(400).json({
        message: "Cannot delete bus with an active trip. Stop the trip first.",
      });
    }

    db.deleteBus(busId);
    res.json({ message: "Bus deleted successfully." });
  } catch (err) {
    console.error("Delete bus error:", err);
    res.status(500).json({ message: "Server error while deleting bus." });
  }
});

// GET /api/auth/users — List all users (admin only)
router.get("/users", authenticate, adminOnly, (req, res) => {
  try {
    const users = db.getAllUsers();
    res.json({ users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ==================== ADMIN: STUDENT MANAGEMENT ====================

// POST /api/auth/students — Create student (admin only)
router.post("/students", authenticate, adminOnly, (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const userId = db.createUser({
      name, email, password,
      role: "STUDENT",
      phone: phone || null,
    });

    const user = db.findUserById(userId);
    res.status(201).json({
      message: "Student account created successfully.",
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, status: user.status },
    });
  } catch (err) {
    console.error("Create student error:", err);
    res.status(500).json({ message: "Server error while creating student." });
  }
});

// GET /api/auth/students — List students (admin only)
router.get("/students", authenticate, adminOnly, (req, res) => {
  try {
    const users = db.getAllUsers().filter(u => u.role === "STUDENT");
    res.json({ students: users });
  } catch (err) {
    console.error("Get students error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// PUT /api/auth/students/:id — Update student (admin only)
router.put("/students/:id", authenticate, adminOnly, (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = db.getUserById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }
    if (student.role !== "STUDENT") {
      return res.status(400).json({ message: "User is not a student." });
    }

    const { name, email, phone, password, status } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (password) updates.password = password;
    if (status) updates.status = status.toUpperCase();

    const updated = db.updateUser(studentId, updates);
    res.json({ message: "Student updated successfully.", user: updated });
  } catch (err) {
    console.error("Update student error:", err);
    res.status(500).json({ message: "Server error while updating student." });
  }
});

// DELETE /api/auth/students/:id — Delete student (admin only)
router.delete("/students/:id", authenticate, adminOnly, (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = db.getUserById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }
    if (student.role !== "STUDENT") {
      return res.status(400).json({ message: "User is not a student." });
    }

    db.deleteUser(studentId);
    res.json({ message: "Student deleted successfully." });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ message: "Server error while deleting student." });
  }
});

module.exports = router;
