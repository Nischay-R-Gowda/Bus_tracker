const jwt = require("jsonwebtoken");

const JWT_SECRET = "bus-tracker-secret-key-2024";
const JWT_EXPIRY = "7d";

// Verify JWT token from Authorization header or query param
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided. Please login." });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request (without password)
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

// Generate a JWT token for a user
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

module.exports = { authenticate, generateToken, JWT_SECRET };
