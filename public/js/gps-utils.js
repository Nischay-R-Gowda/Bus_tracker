// Client-side GPS utilities (mirrors server-side utils/gps.js)

/**
 * Validate GPS coordinates
 */
function validateCoordinates(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    return { valid: false, message: "Invalid coordinates." };
  }
  if (lat < -90 || lat > 90) return { valid: false, message: "Latitude must be between -90 and 90." };
  if (lng < -180 || lng > 180) return { valid: false, message: "Longitude must be between -180 and 180." };
  if (lat === 0 && lng === 0) return { valid: false, message: "GPS has not acquired a fix (0,0)." };
  return { valid: true };
}

/**
 * Haversine distance in meters
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Should we send this location update?
 * Returns { shouldSend, reason, distance, timeDiff }
 */
function shouldSendUpdate(lastLat, lastLng, newLat, newLng, lastTimestamp, minDist = 15, minInterval = 10) {
  if (!lastTimestamp) return { shouldSend: true, reason: "First update", distance: 0, timeDiff: 0 };

  const now = Date.now();
  const lastTime = new Date(lastTimestamp).getTime();
  const timeDiff = (now - lastTime) / 1000;

  if (timeDiff >= minInterval) {
    const dist = haversineDistance(lastLat, lastLng, newLat, newLng);
    return { shouldSend: true, reason: timeDiff >= 30 ? "Heartbeat (30s)" : "Time reached", distance: dist, timeDiff: Math.round(timeDiff) };
  }

  const dist = haversineDistance(lastLat, lastLng, newLat, newLng);
  if (dist >= minDist) {
    return { shouldSend: true, reason: `Moved ${Math.round(dist)}m`, distance: dist, timeDiff: Math.round(timeDiff) };
  }

  return { shouldSend: false, reason: "No movement", distance: dist, timeDiff: Math.round(timeDiff) };
}

/**
 * Calculate ETA in minutes
 */
function calculateETA(distanceMeters, speedKmh = 25) {
  if (speedKmh <= 0) speedKmh = 25;
  const distanceKm = distanceMeters / 1000;
  const etaMinutes = Math.round((distanceMeters / (speedKmh * 1000 / 3600)) / 60);
  return { etaMinutes, distanceKm: Math.round(distanceKm * 100) / 100 };
}

// GPS utility functions for browser use
