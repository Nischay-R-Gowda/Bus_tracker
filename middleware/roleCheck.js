// Role-based access control middleware

// Allow only specific roles to access a route
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

// Driver-only access
const driverOnly = allowRoles("DRIVER");

// Admin-only access
const adminOnly = allowRoles("ADMIN");

// Student-only access
const studentOnly = allowRoles("STUDENT");

// Admin or Driver access
const adminOrDriver = allowRoles("ADMIN", "DRIVER");

// Any authenticated user
const anyAuth = allowRoles("ADMIN", "DRIVER", "STUDENT");

module.exports = {
  allowRoles,
  driverOnly,
  adminOnly,
  studentOnly,
  adminOrDriver,
  anyAuth,
};
