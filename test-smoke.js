// Smoke test - quick verification of new architecture
const http = require("http");

function apiReq(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const r = http.request({ hostname: "127.0.0.1", port: 3001, path, method, headers }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString() }); }
      });
    });
    r.on("error", () => resolve({ status: 0, data: null }));
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

function check(name, condition, detail) {
  if (condition) { console.log("  PASS: " + name); return true; }
  else { console.log("  FAIL: " + name + (detail ? " -- " + detail : "")); return false; }
}

(async () => {
  let pass = 0, fail = 0;
  function c(name, cond, detail) { if (check(name, cond, detail)) pass++; else fail++; }

  console.log("\n=== SMOKE TEST ===\n");

  // Seed test data via HTTP
  await apiReq("POST", "/api/test/seed");

  // 1. Admin login
  console.log("--- Admin ---");
  let res = await apiReq("POST", "/api/auth/login", { email: "admin@test.com", password: "admin123" });
  c("Admin login", res.status === 200, "got " + res.status + " " + JSON.stringify(res.data));
  const adminToken = res.data.token;

  // 2. Student self-register (public, STUDENT only)
  console.log("\n--- Student ---");
  res = await apiReq("POST", "/api/auth/register", { name: "Student", email: "student@test.com", password: "student123" });
  c("Student register", res.status === 201, "got " + res.status);
  c("Role STUDENT", res.data.user && res.data.user.role === "STUDENT");

  // 3. Create route with stops
  console.log("\n--- Route + Stops ---");
  res = await apiReq("POST", "/api/admin/routes", {
    name: "Campus to Hostel",
    description: "Main route",
    stops: [
      { name: "Main Gate", latitude: 12.9350, longitude: 77.5360 },
      { name: "Bus Stop 1", latitude: 12.9370, longitude: 77.5380 },
      { name: "Hostel", latitude: 12.9400, longitude: 77.5400 },
    ]
  }, adminToken);
  c("Route created", res.status === 201, "got " + res.status + " " + JSON.stringify(res.data));
  const routeId = res.data.route ? res.data.route.id : null;

  // 4. Create buses
  console.log("\n--- Buses ---");
  res = await apiReq("POST", "/api/buses", { busNumber: "Bus 01", routeName: "Campus to Hostel" }, adminToken);
  c("Bus 1", res.status === 201, "got " + res.status);
  const busId1 = res.data.bus ? res.data.bus.id : null;

  res = await apiReq("POST", "/api/buses", { busNumber: "Bus 02", routeName: "Campus to Hostel" }, adminToken);
  c("Bus 2", res.status === 201, "got " + res.status);
  const busId2 = res.data.bus ? res.data.bus.id : null;

  // 5. Create driver
  console.log("\n--- Driver ---");
  res = await apiReq("POST", "/api/auth/drivers", {
    name: "Driver Nischay", email: "driver@test.com", password: "driver123"
  }, adminToken);
  c("Driver created", res.status === 201, "got " + res.status);
  const driverId = res.data.user ? res.data.user.id : null;

  // 6. Driver login
  res = await apiReq("POST", "/api/auth/login", { email: "driver@test.com", password: "driver123" });
  c("Driver login", res.status === 200, "got " + res.status);
  const driverToken = res.data.token;

  // 7. Driver sees ALL buses (no permanent assignment)
  console.log("\n--- Bus Selection ---");
  res = await apiReq("GET", "/api/buses", null, driverToken);
  c("Driver gets buses (200)", res.status === 200, "got " + res.status);
  c("Driver sees 2 buses", res.data.buses && res.data.buses.length === 2, "got " + (res.data.buses ? res.data.buses.length : 0));

  // 8. Driver starts trip on Bus 02 (NOT pre-assigned)
  console.log("\n--- Start Trip ---");
  res = await apiReq("POST", "/api/trips/start", { busId: busId2 }, driverToken);
  c("Trip started (201)", res.status === 201, "got " + res.status + " " + JSON.stringify(res.data));
  c("driverId matches", res.data.trip && res.data.trip.driverId === driverId);
  c("busId matches", res.data.trip && res.data.trip.busId === busId2);
  c("Status ACTIVE", res.data.trip && res.data.trip.status === "ACTIVE");

  // 9. Can't start second trip
  res = await apiReq("POST", "/api/trips/start", { busId: busId1 }, driverToken);
  c("Duplicate blocked (400)", res.status === 400);

  // 10. Another driver blocked from same bus
  console.log("\n--- Cross-driver ---");
  const d2id = db._nextId("users");
  db.data.users.push({
    id: d2id, name: "D2", email: "d2@test.com",
    password: bcrypt.hashSync("driver123", 10),
    role: "DRIVER", phone: null, status: "ACTIVE",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  db._save();
  const d2login = await apiReq("POST", "/api/auth/login", { email: "d2@test.com", password: "driver123" });
  res = await apiReq("POST", "/api/trips/start", { busId: busId2 }, d2login.data.token);
  c("Bus occupied (400)", res.status === 400);

  // 11. Location update (trip-based auth)
  console.log("\n--- Location ---");
  res = await apiReq("POST", "/api/location/update", {
    busId: busId2, latitude: 12.9370, longitude: 77.5380,
    speed: 30, accuracy: 15, timestamp: new Date().toISOString()
  }, driverToken);
  c("Location saved (201)", res.status === 201, "got " + res.status);

  // 12. Public location
  res = await apiReq("GET", "/api/public/location/" + busId2);
  c("Public location (200)", res.status === 200);
  c("Has location", res.data.location !== null);
  c("Trip ACTIVE", res.data.trip && res.data.trip.status === "ACTIVE");

  // 13. Public routes
  console.log("\n--- Routes ---");
  res = await apiReq("GET", "/api/public/routes");
  c("Public routes (200)", res.status === 200, "got " + res.status);
  c("Has routes", res.data.routes && res.data.routes.length >= 1);
  if (res.data.routes && res.data.routes[0]) {
    c("Has stops", res.data.routes[0].stops && res.data.routes[0].stops.length >= 1);
  }

  // 14. Admin update stops
  if (routeId) {
    res = await apiReq("PUT", "/api/admin/routes/" + routeId, {
      name: "Campus to Hostel",
      stops: [
        { name: "Main Gate", latitude: 12.9350, longitude: 77.5360 },
        { name: "New Stop", latitude: 12.9380, longitude: 77.5390 },
      ]
    }, adminToken);
    c("Stops updated (200)", res.status === 200, "got " + res.status);
    c("2 stops", res.data.route && res.data.route.stops && res.data.route.stops.length === 2);
  }

  // 15. End trip
  console.log("\n--- End Trip ---");
  res = await apiReq("POST", "/api/trips/stop", {}, driverToken);
  c("Trip stopped (200)", res.status === 200);
  res = await apiReq("GET", "/api/public/location/" + busId2);
  c("Trip null", res.data.trip === null);
  c("Location kept", res.data.location !== null);

  // 16. Pages
  console.log("\n--- Pages ---");
  for (const p of ["/student/dashboard.html", "/driver/dashboard.html", "/admin/dashboard.html", "/student/track.html", "/tracking.html"]) {
    res = await apiReq("GET", p);
    c(p + " (200)", res.status === 200);
  }

  console.log("\n========================================");
  console.log("  RESULTS: " + pass + " passed, " + fail + " failed");
  console.log("========================================\n");
  process.exit(fail > 0 ? 1 : 0);
})();
