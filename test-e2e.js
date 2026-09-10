const http = require("http");

function apiReq(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const r = http.request({ hostname: "127.0.0.1", port: 3001, path: path, method: method, headers: headers }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (e) { resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString() }); }
      });
    });
    r.on("error", (e) => resolve({ status: 0, error: e.message }));
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

  // ===== TEST 1: Admin registration and login =====
  console.log("\n--- TEST 1: Admin registration and login ---");
  const adminReg = await apiReq("POST", "/api/auth/register", { name: "Admin User", email: "admin@test.com", password: "admin123", role: "ADMIN" });
  c("Admin registered", adminReg.status === 201, "got " + adminReg.status);
  c("Admin role is ADMIN", adminReg.data.user.role === "ADMIN", "got " + adminReg.data.user.role);

  const adminLogin = await apiReq("POST", "/api/auth/login", { email: "admin@test.com", password: "admin123" });
  c("Admin login succeeds", adminLogin.status === 200, "got " + adminLogin.status);
  c("Admin role from login is ADMIN", adminLogin.data.user.role === "ADMIN", "got " + adminLogin.data.user.role);
  const adminToken = adminLogin.data.token;

  // ===== TEST 2: Admin creates 4 buses =====
  console.log("\n--- TEST 2: Admin creates 4 buses ---");
  const busData = [
    { busNumber: "Bus 1", routeName: "Campus A → Hostel" },
    { busNumber: "Bus 2", routeName: "Campus A → Metro Station" },
    { busNumber: "Bus 3", routeName: "Campus B → Hostel" },
    { busNumber: "Bus 4", routeName: "Campus B → Tech Park" },
  ];
  const busIds = [];
  for (const bd of busData) {
    const r = await apiReq("POST", "/api/buses", bd, adminToken);
    c("Bus created: " + bd.busNumber, r.status === 201, "got " + r.status);
    if (r.data.bus) busIds.push(r.data.bus.id);
  }
  c("Got 4 bus IDs", busIds.length === 4, "got " + busIds.length);

  // ===== TEST 3: Admin registers driver =====
  console.log("\n--- TEST 3: Register driver ---");
  const driverReg = await apiReq("POST", "/api/auth/register", {
    name: "Ravi Kumar", email: "ravi@test.com", password: "driver123", role: "DRIVER", phone: "+919876543210"
  });
  c("Driver registered", driverReg.status === 201, "got " + driverReg.status);
  c("Driver role is DRIVER", driverReg.data.user.role === "DRIVER", "got " + driverReg.data.user.role);
  const driverId = driverReg.data.user.id;

  // ===== TEST 4: Admin assigns driver to Bus 1 =====
  console.log("\n--- TEST 4: Assign driver to Bus 1 ---");
  const assignBus1 = await apiReq("PUT", "/api/buses/" + busIds[0], { driverId: driverId }, adminToken);
  c("Driver assigned to Bus 1", assignBus1.status === 200, "got " + assignBus1.status);
  c("Bus 1 driverId set", assignBus1.data.bus.driverId === driverId, "got " + assignBus1.data.bus.driverId);

  // ===== TEST 5: Driver login =====
  console.log("\n--- TEST 5: Driver login ---");
  const driverLogin = await apiReq("POST", "/api/auth/login", { email: "ravi@test.com", password: "driver123" });
  c("Driver login succeeds", driverLogin.status === 200, "got " + driverLogin.status);
  c("Driver role from login is DRIVER", driverLogin.data.user.role === "DRIVER", "got " + driverLogin.data.user.role);
  const driverToken = driverLogin.data.token;

  // ===== TEST 6: Driver gets their buses =====
  console.log("\n--- TEST 6: Driver gets assigned buses ---");
  const myBuses = await apiReq("GET", "/api/buses/driver/my-buses", null, driverToken);
  c("Driver gets buses", myBuses.status === 200, "got " + myBuses.status);
  c("Driver sees 1 bus", myBuses.data.buses && myBuses.data.buses.length === 1, "got " + (myBuses.data.buses ? myBuses.data.buses.length : 0));
  if (myBuses.data.buses && myBuses.data.buses.length > 0) {
    c("Bus number is Bus 1", myBuses.data.buses[0].busNumber === "Bus 1", "got " + myBuses.data.buses[0].busNumber);
    c("Driver name is Ravi Kumar", myBuses.data.buses[0].driverName === "Ravi Kumar", "got " + myBuses.data.buses[0].driverName);
    c("Route is Campus A -> Hostel", myBuses.data.buses[0].routeName === "Campus A → Hostel", "got " + myBuses.data.buses[0].routeName);
  }

  // ===== TEST 7: Driver starts trip =====
  console.log("\n--- TEST 7: Start trip ---");
  const tripStart = await apiReq("POST", "/api/trips/start", { busId: busIds[0] }, driverToken);
  c("Trip started (201)", tripStart.status === 201, "got " + tripStart.status);
  c("Trip status is ACTIVE", tripStart.data.trip && tripStart.data.trip.status === "ACTIVE", "got " + (tripStart.data.trip && tripStart.data.trip.status));
  c("Trip has correct busId", tripStart.data.trip && tripStart.data.trip.busId === busIds[0], "got " + (tripStart.data.trip && tripStart.data.trip.busId));
  c("Trip has correct driverId", tripStart.data.trip && tripStart.data.trip.driverId === driverId, "got " + (tripStart.data.trip && tripStart.data.trip.driverId));

  // ===== TEST 8: Driver sends location =====
  console.log("\n--- TEST 8: Send GPS locations ---");
  const loc1 = await apiReq("POST", "/api/location/update", {
    busId: busIds[0], latitude: 15.3647, longitude: 75.1234, speed: 25, accuracy: 15
  }, driverToken);
  c("Location 1 saved (201)", loc1.status === 201, "got " + loc1.status);
  c("Latitude correct", loc1.data.location && Math.abs(loc1.data.location.latitude - 15.3647) < 0.0001);
  c("Longitude correct", loc1.data.location && Math.abs(loc1.data.location.longitude - 75.1234) < 0.0001);

  const loc2 = await apiReq("POST", "/api/location/update", {
    busId: busIds[0], latitude: 15.3650, longitude: 75.1240, speed: 30, accuracy: 12
  }, driverToken);
  c("Location 2 saved", loc2.status === 201);

  // ===== TEST 9: Public access =====
  console.log("\n--- TEST 9: Public tracking access ---");
  const pubBuses = await apiReq("GET", "/api/public/buses");
  c("Public buses (no auth)", pubBuses.status === 200, "got " + pubBuses.status);
  c("Public sees 4 buses", pubBuses.data.buses && pubBuses.data.buses.length === 4, "got " + (pubBuses.data.buses ? pubBuses.data.buses.length : 0));
  c("Bus 1 has driver name Ravi Kumar", pubBuses.data.buses && pubBuses.data.buses[0].driverName === "Ravi Kumar", "got " + (pubBuses.data.buses && pubBuses.data.buses[0].driverName));
  c("Bus 3 has no driver (null)", pubBuses.data.buses && pubBuses.data.buses[2].driverName === null, "got " + (pubBuses.data.buses && pubBuses.data.buses[2].driverName));

  const pubLoc = await apiReq("GET", "/api/public/location/" + busIds[0]);
  c("Public location (200)", pubLoc.status === 200, "got " + pubLoc.status);
  c("Has lat/lng", pubLoc.data.location && pubLoc.data.location.latitude != null, "no location data");
  c("Trip is ACTIVE", pubLoc.data.trip && pubLoc.data.trip.status === "ACTIVE");
  c("Freshness is LIVE", pubLoc.data.freshness && pubLoc.data.freshness.status === "LIVE", "got " + (pubLoc.data.freshness && pubLoc.data.freshness.status));

  const pubLocNoTrip = await apiReq("GET", "/api/public/location/" + busIds[1]);
  c("Bus 2 no trip: null location", pubLocNoTrip.status === 200 && pubLocNoTrip.data.location === null, "got status=" + pubLocNoTrip.status);

  const pubTrips = await apiReq("GET", "/api/public/trips/active");
  c("Active trips: 1", pubTrips.status === 200 && pubTrips.data.trips && pubTrips.data.trips.length === 1, "got " + (pubTrips.data.trips && pubTrips.data.trips.length));

  // ===== TEST 10: Cross-role protection =====
  console.log("\n--- TEST 10: Cross-role protection ---");
  const adminOnDriver = await apiReq("GET", "/api/trips/my-trip", null, adminToken);
  c("ADMIN on driver endpoint (403)", adminOnDriver.status === 403, "got " + adminOnDriver.status);

  const driverOnUsers = await apiReq("GET", "/api/auth/users", null, driverToken);
  c("DRIVER on admin endpoint (403)", driverOnUsers.status === 403, "got " + driverOnUsers.status);

  // ===== TEST 11: Unassigned driver =====
  console.log("\n--- TEST 11: Unassigned driver ---");
  const driver2 = await apiReq("POST", "/api/auth/register", { name: "D2", email: "d2@test.com", password: "driver123", role: "DRIVER" });
  const d2login = await apiReq("POST", "/api/auth/login", { email: "d2@test.com", password: "driver123" });
  const noBus = await apiReq("POST", "/api/trips/start", { busId: busIds[0] }, d2login.data.token);
  c("Unassigned driver denied (403)", noBus.status === 403, "got " + noBus.status);
  c("Clear error message", noBus.data.message && noBus.data.message.includes("not assigned"), "got: " + noBus.data.message);

  // ===== TEST 12: Stop trip =====
  console.log("\n--- TEST 12: Stop trip ---");
  const stopTrip = await apiReq("POST", "/api/trips/stop", {}, driverToken);
  c("Trip stopped (200)", stopTrip.status === 200, "got " + stopTrip.status);

  const afterStop = await apiReq("GET", "/api/public/location/" + busIds[0]);
  c("After stop: location still visible", afterStop.status === 200 && afterStop.data.location !== null);
  c("After stop: trip is null", afterStop.data.trip === null, "trip=" + JSON.stringify(afterStop.data.trip));

  // ===== TEST 13: Edge cases =====
  console.log("\n--- TEST 13: Edge cases ---");
  const badBus = await apiReq("GET", "/api/public/location/999");
  c("Non-existent bus (404)", badBus.status === 404, "got " + badBus.status);

  const noAuthBuses = await apiReq("GET", "/api/buses");
  c("No auth on /api/buses (401)", noAuthBuses.status === 401, "got " + noAuthBuses.status);

  // ===== TEST 14: Pages serve correctly =====
  console.log("\n--- TEST 14: Pages serve ---");
  const pages = [
    { path: "/", title: "IIIT Dharwad" },
    { path: "/tracking.html", title: "Live Bus Tracking" },
    { path: "/login.html", title: "Login" },
    { path: "/admin/dashboard.html", title: "Admin Dashboard" },
    { path: "/driver/dashboard.html", title: "Driver Dashboard" },
  ];
  for (const p of pages) {
    const r = await apiReq("GET", p.path);
    const hasTitle = r.data && r.data.includes(p.title);
    c(p.path + " serves with title '" + p.title + "'", r.status === 200 && hasTitle, "status=" + r.status);
  }

  // ===== SUMMARY =====
  console.log("\n========================================");
  console.log("RESULTS: " + pass + " passed, " + fail + " failed");
  console.log("========================================");
  if (fail === 0) console.log("ALL TESTS PASSED");
  else console.log("SOME TESTS FAILED");

  process.exit(fail > 0 ? 1 : 0);
})();
