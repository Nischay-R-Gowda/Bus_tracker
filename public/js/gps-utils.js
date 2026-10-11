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

/**
 * Find the nearest stop/landmark to the given bus position.
 * Returns the stop with the smallest haversine distance.
 * @param {number} lat - Bus latitude
 * @param {number} lng - Bus longitude
 * @param {Array<{name: string, latitude: number, longitude: number}>} stops
 * @returns {{ name: string, distanceMeters: number } | null}
 */
function findNextStop(lat, lng, stops) {
  if (!stops || stops.length === 0) return null;

  let nearest = null;
  let minDist = Infinity;

  for (const stop of stops) {
    const dist = haversineDistance(lat, lng, stop.latitude, stop.longitude);
    if (dist < minDist) {
      minDist = dist;
      nearest = stop;
    }
  }

  return nearest ? { name: nearest.name, distanceMeters: minDist } : null;
}

/**
 * Build cumulative segment distances along a list of stops (in order).
 * Returns an array of { fromIndex, toIndex, distanceMeters, cumulativeMeters }.
 * @param {Array<{latitude: number, longitude: number}>} stops
 * @returns {Array<{fromIndex: number, toIndex: number, distanceMeters: number, cumulativeMeters: number}>}
 */
function buildSegmentDistances(stops) {
  const segments = [];
  let cumulative = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const d = haversineDistance(stops[i].latitude, stops[i].longitude, stops[i + 1].latitude, stops[i + 1].longitude);
    cumulative += d;
    segments.push({
      fromIndex: i,
      toIndex: i + 1,
      distanceMeters: d,
      cumulativeMeters: cumulative,
    });
  }
  return segments;
}

/**
 * Given stops (ordered start → end), find the next upcoming stop
 * from the bus's current position along the route direction.
 *
 * Strategy:
 * 1. Find the nearest stop → index i
 * 2. The next stop is stops[i + 1] (or stops[i] if at the end)
 * 3. ETA uses distance from bus to that next stop at average speed
 *
 * @param {number} busLat
 * @param {number} busLng
 * @param {Array<{name: string, latitude: number, longitude: number}>} stops
 * @param {Array} segments - from buildSegmentDistances (unused here, reserved for future)
 * @param {number} avgSpeedKmh - average bus speed
 * @returns {{ etaMinutes: number, distanceKm: number, nextStopName: string }}
 */
function estimateETA(busLat, busLng, stops, segments, avgSpeedKmh = 25) {
  if (!stops || stops.length === 0) {
    return { etaMinutes: null, distanceKm: null, nextStopName: null };
  }

  // Find nearest stop index
  let nearestIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const d = haversineDistance(busLat, busLng, stops[i].latitude, stops[i].longitude);
    if (d < minDist) {
      minDist = d;
      nearestIdx = i;
    }
  }

  // The next stop is the one after the nearest in route order
  let targetIdx;
  if (nearestIdx >= stops.length - 1) {
    // Bus is at or past the last stop — destination reached
    targetIdx = stops.length - 1;
  } else {
    targetIdx = nearestIdx + 1;
  }

  const targetStop = stops[targetIdx];
  const distToTarget = haversineDistance(busLat, busLng, targetStop.latitude, targetStop.longitude);
  const { etaMinutes, distanceKm } = calculateETA(distToTarget, avgSpeedKmh);

  return {
    etaMinutes,
    distanceKm,
    nextStopName: targetStop.name,
  };
}

// GPS utility functions for browser use
