// Phase 1 Test Suite - Security Hardened
const http = require("http");
const BASE = "http://127.0.0.1:3001";
let adminToken = "";
let driverToken = "";
let busId1 = null;
let busId2 = null;
let testsPassed = 0;
let testsFailed = 0;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method: method,
      headers: { "Content-Type": "application/json" }
    };
    if (token) options.headers["Authorization"] = "Bearer " + token;
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (condition) { console.log("  [PASS] " + message); testsPassed++; }
  else { console.log("  [FAIL] " + message); testsFailed++; }
}

async function runTests() {
  console.log("\n========================================");
  console.log("  PHASE 1 TEST SUITE (Security Hardened)");
  console.log("========================================\n");

  // Bootstrap Admin — use the register endpoint without role (defaults to ADMIN)
  console.log("--- AUTH: Bootstrap Admin ---");
  let res = await request("POST", "/api/auth/register", {
    name: "Admin User", email: "admin@college.edu", password: "admin123"
  });
  assert(res.status === 201, "Admin registered (201)");
  assert(res.data.user.role === "ADMIN", "Admin role is ADMIN");
  assert(!res.data.user.password, "Password not returned");

  res = await request("POST", "/api/auth/login", { email: "admin@college.edu", password: "admin123" });
  assert(res.status === 200, "Admin login succeeds (200)");
  adminToken = res.data.token;

  // Create Driver via Admin
  console.log("\n--- AUTH: Driver Created by Admin ---");
  res = await request("POST", "/api/auth/drivers", {
    name: "Driver Ravi", email: "driver@college.edu", password: "driver123", phone: "+919876543210"
  }, adminToken);
  assert(res.status === 201, "Admin creates driver (201)");
  assert(res.data.user.role === "DRIVER", "Driver role is DRIVER");
  assert(res.data.user.phone === "+919876543210", "Driver phone saved");
  assert(res.data.user.status === "ACTIVE", "Driver status ACTIVE");

  // Public Registration Blocked
  console.log("\n--- AUTH: Public Registration Blocked ---");
  res = await request("POST", "/api/auth/register", {
    name: "Fake", email: "fake@test.com", password: "pass123", role: "DRIVER"
  });
  assert(res.status === 403, "Public DRIVER registration blocked (403)");

  res = await request("POST", "/api/auth/register", {
    name: "Dup", email: "admin@college.edu", password: "x", role: "ADMIN"
  });
  assert(res.status === 409, "Duplicate email rejected (409)");

  // Login tests
  console.log("\n--- AUTH: Login ---");
  res = await request("POST", "/api/auth/login", { email: "driver@college.edu", password: "driver123" });
  assert(res.status === 200, "Driver login succeeds");
  assert(res.data.user.role === "DRIVER", "Login returns DRIVER role");
  assert(res.data.user.status === "ACTIVE", "Login returns ACTIVE status");
  driverToken = res.data.token;

  res = await request("POST", "/api/auth/login", { email: "admin@college.edu", password: "wrong" });
  assert(res.status === 401, "Wrong password rejected (401)");

  res = await request("POST", "/api/auth/login", { email: "none@test.com", password: "x" });
  assert(res.status === 401, "Non-existent user rejected (401)");

  // Profile
  console.log("\n--- AUTH: Get Profile ---");
  res = await request("GET", "/api/auth/me", null, adminToken);
  assert(res.status === 200, "Get profile works (200)");
  assert(res.data.user.id === 1, "Profile returns correct user");

  res = await request("GET", "/api/auth/me", null, "invalidtoken");
  assert(res.status === 401, "Invalid token rejected (401)");

  // Users Admin only
  console.log("\n--- AUTH: Get Users (Admin only) ---");
  res = await request("GET", "/api/auth/users", null, adminToken);
  assert(res.status === 200, "Admin can get all users (200)");
  assert(res.data.users.length === 2, "Returns 2 users");

  res = await request("GET", "/api/auth/users", null, driverToken);
  assert(res.status === 403, "Driver cannot get all users (403)");

  // Create Buses
  console.log("\n--- BUSES: Create Bus ---");
  res = await request("POST", "/api/buses", {
    busNumber: "Bus 1", registration: "KA24", routeName: "MAIN CAMPUS TO HOSTEL", driverId: 2
  }, adminToken);
  assert(res.status === 201, "Bus 1 created (201)");
  assert(res.data.bus.busNumber === "Bus 1", "Bus number correct");
  assert(res.data.bus.status === "INACTIVE", "Defaults to INACTIVE");
  assert(res.data.bus.driverName === "Driver Ravi", "Driver name populated");
  busId1 = res.data.bus.id;

  res = await request("POST", "/api/buses", {
    busNumber: "Bus 2", registration: "KA-02", routeName: "Campus to City", driverId: 2
  }, adminToken);
  assert(res.status === 201, "Bus 2 created");
  busId2 = res.data.bus.id;

  res = await request("POST", "/api/buses", { busNumber: "Bus 1" }, adminToken);
  assert(res.status === 409, "Duplicate bus number rejected (409)");

  // Read Buses
  console.log("\n--- BUSES: Read ---");
  res = await request("GET", "/api/buses", null, adminToken);
  assert(res.status === 200, "Get all buses (200)");
  assert(res.data.buses.length === 2, "Returns 2 buses");

  res = await request("GET", "/api/buses", null, "notoken");
  assert(res.status === 401, "No token on buses = 401");

  res = await request("GET", "/api/buses/" + busId1, null, adminToken);
  assert(res.status === 200, "Get bus by ID (200)");

  res = await request("GET", "/api/buses/99999", null, adminToken);
  assert(res.status === 404, "Non-existent bus = 404");

  // Update Bus
  console.log("\n--- BUSES: Update ---");
  res = await request("PUT", "/api/buses/" + busId1, { routeName: "UPDATED ROUTE" }, adminToken);
  assert(res.status === 200, "Bus update (200)");
  assert(res.data.bus.routeName === "UPDATED ROUTE", "Route updated");

  res = await request("PUT", "/api/buses/" + busId1, { routeName: "X" }, driverToken);
  assert(res.status === 403, "Driver cannot update bus (403)");

  // Driver's Buses
  console.log("\n--- BUSES: Driver's Buses ---");
  res = await request("GET", "/api/buses/driver/my-buses", null, driverToken);
  assert(res.status === 200, "Driver gets their buses (200)");
  assert(res.data.buses.length === 2, "Driver sees 2 assigned buses");

  res = await request("GET", "/api/buses/driver/my-buses");
  assert(res.status === 401, "No auth on my-buses = 401");

  // Start Trip
  console.log("\n--- TRIPS: Start Trip ---");
  res = await request("POST", "/api/trips/start", { busId: busId1 }, driverToken);
  assert(res.status === 201, "Trip started (201)");
  assert(res.data.trip.status === "ACTIVE", "Trip is ACTIVE");

  res = await request("POST", "/api/trips/start", { busId: busId1 }, driverToken);
  assert(res.status === 400, "Duplicate trip blocked (400)");

  res = await request("POST", "/api/trips/start", { busId: 99999 }, driverToken);
  assert(res.status === 404, "Non-existent bus = 404");

  res = await request("POST", "/api/trips/start", { busId: busId2 }, driverToken);
  assert(res.status === 400, "Driver already has active trip (400)");

  // Active Trips
  console.log("\n--- TRIPS: Get Active Trips ---");
  res = await request("GET", "/api/trips/active", null, adminToken);
  assert(res.status === 200, "Admin views active trips (200)");
  assert(res.data.trips.length === 1, "One active trip");

  res = await request("GET", "/api/trips/active");
  assert(res.status === 401, "No auth on active trips = 401");

  // My Trip
  console.log("\n--- TRIPS: Get My Trip ---");
  res = await request("GET", "/api/trips/my-trip", null, driverToken);
  assert(res.status === 200, "Driver gets their trip (200)");
  assert(res.data.trip !== null, "Trip data returned");

  res = await request("GET", "/api/trips/my-trip", null, adminToken);
  assert(res.status === 403, "ADMIN on driver endpoint (403)");

  // Send Location
  console.log("\n--- LOCATIONS: Send Location ---");
  const now = new Date().toISOString();
  res = await request("POST", "/api/location/update", {
    busId: busId1, latitude: 12.9716, longitude: 77.5946, speed: 25.5, heading: 90, accuracy: 12.3, timestamp: now
  }, driverToken);
  assert(res.status === 201, "Location saved (201)");
  assert(Math.abs(res.data.location.latitude - 12.9716) < 0.0001, "Latitude correct");

  res = await request("POST", "/api/location/update", { busId: busId1, latitude: 999, longitude: 77.5946 }, driverToken);
  assert(res.status === 400, "Invalid latitude rejected (400)");

  res = await request("POST", "/api/location/update", { busId: busId1, latitude: 0, longitude: 0 }, driverToken);
  assert(res.status === 400, "(0,0) rejected (400)");

  res = await request("POST", "/api/location/update", { busId: busId1, latitude: 12.9716, longitude: 77.5946 }, "notoken");
  assert(res.status === 401, "No auth on location update (401)");

  await request("POST", "/api/location/update", {
    busId: busId1, latitude: 12.9720, longitude: 77.5950, speed: 30.0, accuracy: 10.5, timestamp: new Date().toISOString()
  }, driverToken);

  // Public Location Access
  console.log("\n--- LOCATIONS: Public Access ---");
  res = await request("GET", "/api/public/location/" + busId1);
  assert(res.status === 200, "Public gets location (200)");
  assert(res.data.location !== null, "Location data returned");
  assert(Math.abs(res.data.location.latitude - 12.9720) < 0.0001, "Latest location correct");
  assert(res.data.freshness !== undefined, "Freshness returned");

  res = await request("GET", "/api/public/location/99999");
  assert(res.status === 404, "Non-existent bus = 404");

  res = await request("GET", "/api/public/location/" + busId1 + "/history?limit=5");
  assert(res.status === 200, "History works (200)");
  assert(res.data.history.length >= 2, "At least 2 history points");

  res = await request("GET", "/api/public/buses");
  assert(res.status === 200, "Public buses (200)");

  res = await request("GET", "/api/public/trips/active");
  assert(res.status === 200, "Public active trips (200)");

  // Stop Trip
  console.log("\n--- TRIPS: Stop Trip ---");
  res = await request("POST", "/api/trips/stop", {}, driverToken);
  assert(res.status === 200, "Trip stopped (200)");

  res = await request("GET", "/api/trips/my-trip", null, driverToken);
  assert(res.data.trip === null, "Trip is now null");

  res = await request("POST", "/api/trips/stop", {}, driverToken);
  assert(res.status === 400, "No active trip to stop (400)");

  // Delete Bus
  console.log("\n--- BUSES: Delete Bus ---");
  res = await request("DELETE", "/api/buses/" + busId2, null, adminToken);
  assert(res.status === 200, "Bus deleted (200)");

  res = await request("GET", "/api/buses/" + busId2, null, adminToken);
  assert(res.status === 404, "Deleted bus not found (404)");

  // Cross-role protection
  console.log("\n--- ROLE: Cross-role protection ---");
  res = await request("GET", "/api/trips/my-trip", null, adminToken);
  assert(res.status === 403, "ADMIN on driver endpoint (403)");

  res = await request("GET", "/api/auth/users", null, driverToken);
  assert(res.status === 403, "DRIVER on admin endpoint (403)");

  res = await request("GET", "/api/auth/drivers", null, driverToken);
  assert(res.status === 403, "DRIVER on drivers endpoint (403)");

  res = await request("DELETE", "/api/auth/drivers/2", null, driverToken);
  assert(res.status === 403, "DRIVER DELETE driver (403)");

  res = await request("DELETE", "/api/buses/" + busId1, null, driverToken);
  assert(res.status === 403, "DRIVER DELETE bus (403)");

  // Driver Management (Admin)
  console.log("\n--- DRIVER MGMT: Admin CRUD ---");
  res = await request("POST", "/api/auth/drivers", {
    name: "Test Driver", email: "testdriver@test.com", password: "test123"
  }, adminToken);
  assert(res.status === 201, "Admin creates driver (201)");

  res = await request("GET", "/api/auth/drivers", null, adminToken);
  assert(res.status === 200, "Admin gets drivers list (200)");

  var td = null;
  res.data.drivers.forEach(function(d) { if (d.email === "testdriver@test.com") td = d; });
  assert(td !== null, "Test driver found in list");

  res = await request("PUT", "/api/auth/drivers/" + td.id, { status: "DISABLED" }, adminToken);
  assert(res.status === 200, "Admin disables driver (200)");
  assert(res.data.user.status === "DISABLED", "Status is DISABLED");

  res = await request("POST", "/api/auth/login", { email: "testdriver@test.com", password: "test123" });
  assert(res.status === 403, "Disabled driver login blocked (403)");

  res = await request("PUT", "/api/auth/drivers/" + td.id, { status: "ACTIVE" }, adminToken);
  assert(res.status === 200, "Admin re-enables driver (200)");

  res = await request("PUT", "/api/auth/drivers/" + td.id, { name: "Updated Name" }, adminToken);
  assert(res.status === 200, "Admin edits driver (200)");
  assert(res.data.user.name === "Updated Name", "Name updated");

  // Test driver active trip protection - test driver must be the one with the trip
  res = await request("POST", "/api/trips/start", { busId: busId1 }, driverToken);
  await request("POST", "/api/trips/stop", {}, driverToken); // stop driver Ravi's trip

  // Assign test driver to bus 2 and start a trip as test driver
  // First create bus for test driver
  let busRes = await request("POST", "/api/buses", { busNumber: "Test Bus", routeName: "Test Route", driverId: td.id }, adminToken);
  let testBusId = busRes.data.bus.id;
  // Login as test driver
  let testLogin = await request("POST", "/api/auth/login", { email: "testdriver@test.com", password: "test123" });
  let testDriverToken = testLogin.data.token;
  await request("POST", "/api/trips/start", { busId: testBusId }, testDriverToken);
  res = await request("DELETE", "/api/auth/drivers/" + td.id, null, adminToken);
  assert(res.status === 400, "Cannot delete driver with active trip (400)");

  await request("POST", "/api/trips/stop", {}, testDriverToken);
  res = await request("DELETE", "/api/auth/drivers/" + td.id, null, adminToken);
  assert(res.status === 200, "Driver deleted after trip stop (200)");

  res = await request("POST", "/api/auth/login", { email: "testdriver@test.com", password: "test123" });
  assert(res.status === 401, "Deleted driver cannot login (401)");

  // Bus delete with active trip
  console.log("\n--- BUS DELETE: Active trip protection ---");
  await request("POST", "/api/trips/start", { busId: busId1 }, driverToken);
  res = await request("DELETE", "/api/buses/" + busId1, null, adminToken);
  assert(res.status === 400, "Cannot delete bus with active trip (400)");

  await request("POST", "/api/trips/stop", {}, driverToken);
  res = await request("DELETE", "/api/buses/" + busId1, null, adminToken);
  assert(res.status === 200, "Bus deleted after trip stop (200)");

  // Summary
  console.log("\n========================================");
  console.log("  RESULTS: " + testsPassed + " passed, " + testsFailed + " failed");
  console.log("========================================\n");
  if (testsFailed > 0) { console.log("SOME TESTS FAILED"); process.exit(1); }
  else { console.log("ALL TESTS PASSED"); process.exit(0); }
}

runTests().catch(function(err) {
  console.error("Test runner error:", err);
  process.exit(1);
});
