// GPS Utility Functions
// - Coordinate validation
// - Haversine distance calculation
// - Speed/distance/throttling utilities

/**
 * Validate GPS coordinates
 * @param {number} latitude - Latitude value
 * @param {number} longitude - Longitude value
 * @returns {{ valid: boolean, message: string }}
 */
function validateCoordinates(latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { valid: false, message: "Latitude and longitude must be numbers." };
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return { valid: false, message: "Latitude and longitude must be valid numbers." };
  }

  if (latitude < -90 || latitude > 90) {
    return { valid: false, message: "Latitude must be between -90 and 90." };
  }

  if (longitude < -180 || longitude > 180) {
    return { valid: false, message: "Longitude must be between -180 and 180." };
  }

  if (latitude === 0 && longitude === 0) {
    return { valid: false, message: "Invalid location: coordinates are (0, 0). GPS may not have acquired a fix." };
  }

  return { valid: true, message: "Valid coordinates." };
}

/**
 * Calculate distance between two GPS coordinates using the Haversine formula
 * Returns distance in meters
 *
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return Math.round(distance); // Round to nearest meter
}

/**
 * Calculate ETA (estimated time of arrival)
 * @param {number} distanceMeters - Distance in meters
 * @param {number} speedKmh - Speed in km/h (optional, defaults to 30 km/h average bus speed)
 * @returns {{ etaMinutes: number, distanceKm: number }} ETA in minutes
 */
function calculateETA(distanceMeters, speedKmh = 30) {
  if (speedKmh <= 0) speedKmh = 30; // Default average bus speed

  const distanceKm = distanceMeters / 1000;
  const speedMs = (speedKmh * 1000) / 3600; // Convert km/h to m/s
  const etaSeconds = distanceMeters / speedMs;
  const etaMinutes = Math.round(etaSeconds / 60);

  return {
    etaMinutes,
    distanceKm: Math.round(distanceKm * 100) / 100,
  };
}

/**
 * Check if a location update should be sent based on throttling rules
 * @param {number} lastLat - Previous latitude
 * @param {number} lastLng - Previous longitude
 * @param {number} newLat - New latitude
 * @param {number} newLng - New longitude
 * @param {number} lastTimestamp - Previous timestamp (ISO string)
 * @param {number} minDistanceMeters - Minimum distance change (default 15m)
 * @param {number} minIntervalSeconds - Minimum time interval (default 10s)
 * @returns {{ shouldSend: boolean, reason: string, distance: number, timeDiff: number }}
 */
function shouldSendUpdate(lastLat, lastLng, newLat, newLng, lastTimestamp, minDistanceMeters = 15, minIntervalSeconds = 10) {
  const now = Date.now();
  const lastTime = new Date(lastTimestamp).getTime();
  const timeDiff = (now - lastTime) / 1000; // seconds

  // Always send if we have no previous location
  if (!lastLat || !lastLng || !lastTimestamp) {
    return { shouldSend: true, reason: "First location update", distance: 0, timeDiff: 0 };
  }

  // Always send if enough time has passed (heartbeat)
  if (timeDiff >= minIntervalSeconds) {
    const distance = calculateDistance(lastLat, lastLng, newLat, newLng);
    return {
      shouldSend: true,
      reason: timeDiff >= 30 ? "Heartbeat (30s)" : "Time interval reached",
      distance,
      timeDiff: Math.round(timeDiff),
    };
  }

  // If moved enough distance, send update
  const distance = calculateDistance(lastLat, lastLng, newLat, newLng);
  if (distance >= minDistanceMeters) {
    return {
      shouldSend: true,
      reason: `Distance change: ${distance}m`,
      distance,
      timeDiff: Math.round(timeDiff),
    };
  }

  // Skip — not enough movement and not enough time passed
  return {
    shouldSend: false,
    reason: "No significant movement",
    distance,
    timeDiff: Math.round(timeDiff),
  };
}

/**
 * Format coordinates to a fixed number of decimal places
 * (Helps reduce data size for API calls)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} decimals - Decimal places (default 6 = ~0.1m precision)
 * @returns {{ lat: number, lng: number }}
 */
function formatCoordinates(lat, lng, decimals = 6) {
  const factor = Math.pow(10, decimals);
  return {
    lat: Math.round(lat * factor) / factor,
    lng: Math.round(lng * factor) / factor,
  };
}

module.exports = {
  validateCoordinates,
  calculateDistance,
  calculateETA,
  shouldSendUpdate,
  formatCoordinates,
};
