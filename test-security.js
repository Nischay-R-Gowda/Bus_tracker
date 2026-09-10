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

  // =============================================
  // SETUP: Bootstrap admin, create test data
  // =============================================
  console.log("\n=== SETUP ===");

  // Register admin (bootstrap)
  const adminReg = await apiReq("POST", "/api/auth/register", {
    name: "Admin", email: "admin@test.com", password: "admin123", role: "ADMIN"
  });
  c("Admin bootstrap registration works", adminReg.status === 201, "got " + adminReg.status);

  const adminLogin = await apiReq("POST", "/api/auth/login", { email: "admin@test.com", password: "admin123" });
  c("Admin login works", adminLogin.status === 200);
  const adminToken = adminLogin.data.token;

  // Create 4 buses
  const busIds = [];
  for (let i = 1; i <= 4; i++) {
    const r = await apiReq("POST", "/api/buses", { busNumber: "Bus " + i, routeName: "Route " + i }, adminToken);
    if (r.status === 201) busIds.push(r.data.bus.id);
  }
  c("4 buses created", busIds.length === 4, "got " + busIds.length);

  // Create 2 drivers
  const d1Reg = await apiReq("POST", "/api/auth/drivers", {
    name: "Ravi Kumar", email: "ravi@test.com", password: "driver123", phone: "+919876543210"
  }, adminToken);
  c("Admin creates driver Ravi", d1Reg.status === 201, "got " + d1Reg.status);

  const d2Reg = await apiReq("POST", "/api/auth/drivers", {
    name: "John Doe", email: "john@test.com", password: "driver123"
  }, adminToken);
  c("Admin creates driver John", d2Reg.status === 201, "got " + d2Reg.status);

  // Assign Ravi to Bus 1
  await apiReq("PUT", "/api/buses/" + busIds[0], { driverId: d1Reg.data.user.id }, adminToken);

  // Assign John to Bus 2
  await apiReq("PUT", "/api/buses/" + busIds[1], { driverId: d2Reg.data.user.id }, adminToken);

  // Driver logins
  const raviLogin = await apiReq("POST", "/api/auth/login", { email: "ravi@test.com", password: "driver123" });
  const johnLogin = await apiReq("POST", "/api/auth/login", { email: "john@test.com", password: "driver123" });
  c("Ravi can login", raviLogin.status === 200);
  c("John can login", johnLogin.status === 200);
  const raviToken = raviLogin.data.token;
  const johnToken = johnLogin.data.token;

  // =============================================
  // TEST 1: Public cannot register as DRIVER
  // =============================================
  console.log("\n--- TEST 1: Public DRIVER registration blocked ---");
  const pubDriverReg = await apiReq("POST", "/api/auth/register", {
    name: "Fake", email: "fake@test.com", password: "pass123", role: "DRIVER"
  });
  c("Public DRIVER register returns 403", pubDriverReg.status === 403, "got " + pubDriverReg.status);
  c("Error message mentions admin", pubDriverReg.data.message && pubDriverReg.data.message.includes("admin"), "got: " + pubDriverReg.data.message);

  // Verify fake driver was NOT created
  const fakeCheck = await apiReq("POST", "/api/auth/login", { email: "fake@test.com", password: "pass123" });
  c("Fake driver cannot login", fakeCheck.status === 401, "got " + fakeCheck.status);

  // =============================================
  // TEST 2: Public cannot access admin APIs
  // =============================================
  console.log("\n--- TEST 2: Public cannot access admin APIs ---");
  const pubUsers = await apiReq("GET", "/api/auth/users");
  c("Public GET /api/auth/users returns 401", pubUsers.status === 401, "got " + pubUsers.status);

  const pubDrivers = await apiReq("GET", "/api/auth/drivers");
  c("Public GET /api/auth/drivers returns 401", pubDrivers.status === 401, "got " + pubDrivers.status);

  const pubDeleteDriver = await apiReq("DELETE", "/api/auth/drivers/1");
  c("Public DELETE driver returns 401", pubDeleteDriver.status === 401, "got " + pubDeleteDriver.status);

  const pubCreateDriver = await apiReq("POST", "/api/auth/drivers", { name: "X", email: "x@test.com", password: "pass123" });
  c("Public POST /api/auth/drivers returns 401", pubCreateDriver.status === 401, "got " + pubCreateDriver.status);

  // =============================================
  // TEST 3: Public cannot access driver dashboard
  // =============================================
  console.log("\n--- TEST 3: Public cannot access driver APIs ---");
  const pubTripStart = await apiReq("POST", "/api/trips/start", { busId: busIds[0] });
  c("Public start trip returns 401", pubTripStart.status === 401, "got " + pubTripStart.status);

  const pubMyTrip = await apiReq("GET", "/api/trips/my-trip");
  c("Public my-trip returns 401", pubMyTrip.status === 401, "got " + pubMyTrip.status);

  const pubMyBuses = await apiReq("GET", "/api/buses/driver/my-buses");
  c("Public my-buses returns 401", pubMyBuses.status === 401, "got " + pubMyBuses.status);

  // =============================================
  // TEST 4: Driver cannot access admin APIs
  // =============================================
  console.log("\n--- TEST 4: DRIVER cannot access admin APIs ---");
  const driverUsers = await apiReq("GET", "/api/auth/users", null, raviToken);
  c("DRIVER GET /api/auth/users = 403", driverUsers.status === 403, "got " + driverUsers.status);

  const driverCreateDriver = await apiReq("POST", "/api/auth/drivers", { name: "X", email: "x@test.com", password: "pass123" }, raviToken);
  c("DRIVER POST /api/auth/drivers = 403", driverCreateDriver.status === 403, "got " + driverCreateDriver.status);

  const driverDeleteDriver = await apiReq("DELETE", "/api/auth/drivers/1", null, raviToken);
  c("DRIVER DELETE driver = 403", driverDeleteDriver.status === 403, "got " + driverDeleteDriver.status);

  const driverDeleteBus = await apiReq("DELETE", "/api/buses/" + busIds[0], null, raviToken);
  c("DRIVER DELETE bus = 403", driverDeleteBus.status === 403, "got " + driverDeleteBus.status);

  // =============================================
  // TEST 5: Admin CRUD works
  // =============================================
  console.log("\n--- TEST 5: Admin can create/list drivers ---");
  const allDrivers = await apiReq("GET", "/api/auth/drivers", null, adminToken);
  c("Admin GET drivers returns 200", allDrivers.status === 200, "got " + allDrivers.status);
  c("Admin sees 2 drivers", allDrivers.data.drivers && allDrivers.data.drivers.length === 2, "got " + (allDrivers.data.drivers && allDrivers.data.drivers.length));

  // =============================================
  // TEST 6: Driver starts trip — works
  // =============================================
  console.log("\n--- TEST 6: Driver starts trip ---");
  const tripStart = await apiReq("POST", "/api/trips/start", { busId: busIds[0] }, raviToken);
  c("Ravi starts trip (201)", tripStart.status === 201, "got " + tripStart.status);
  c("Trip status ACTIVE", tripStart.data.trip && tripStart.data.trip.status === "ACTIVE");

  // Send location
  const loc1 = await apiReq("POST", "/api/location/update", {
    busId: busIds[0], latitude: 15.3647, longitude: 75.1234, speed: 25, accuracy: 15
  }, raviToken);
  c("Ravi sends location (201)", loc1.status === 201, "got " + loc1.status);

  // =============================================
  // TEST 7: Disable driver
  // =============================================
  console.log("\n--- TEST 7: Disable driver ---");
  const disableJohn = await apiReq("PUT", "/api/auth/drivers/" + d2Reg.data.user.id,
    { status: "DISABLED" }, adminToken);
  c("Admin disables John (200)", disableJohn.status === 200, "got " + disableJohn.status);
  c("John status is DISABLED", disableJohn.data.user && disableJohn.data.user.status === "DISABLED");

  // John tries to login
  const johnLoginAfterDisable = await apiReq("POST", "/api/auth/login", { email: "john@test.com", password: "driver123" });
  c("Disabled John cannot login (403)", johnLoginAfterDisable.status === 403, "got " + johnLoginAfterDisable.status);
  c("Error mentions disabled", johnLoginAfterDisable.data.message && johnLoginAfterDisable.data.message.toLowerCase().includes("disabled"), "got: " + johnLoginAfterDisable.data.message);

  // Re-enable John
  const enableJohn = await apiReq("PUT", "/api/auth/drivers/" + d2Reg.data.user.id,
    { status: "ACTIVE" }, adminToken);
  c("Admin re-enables John (200)", enableJohn.status === 200);
  const johnLoginAfterEnable = await apiReq("POST", "/api/auth/login", { email: "john@test.com", password: "driver123" });
  c("Re-enabled John can login", johnLoginAfterEnable.status === 200, "got " + johnLoginAfterEnable.status);

  // =============================================
  // TEST 8: Cannot delete driver with active trip
  // =============================================
  console.log("\n--- TEST 8: Cannot delete driver with active trip ---");
  const deleteRavi = await apiReq("DELETE", "/api/auth/drivers/" + d1Reg.data.user.id, null, adminToken);
  c("Delete driver with active trip = 400", deleteRavi.status === 400, "got " + deleteRavi.status);
  c("Error mentions active trip", deleteRavi.data.message && deleteRavi.data.message.toLowerCase().includes("active trip"), "got: " + deleteRavi.data.message);

  // =============================================
  // TEST 9: Stop trip, then delete driver
  // =============================================
  console.log("\n--- TEST 9: Delete driver after stopping trip ---");
  await apiReq("POST", "/api/trips/stop", {}, raviToken);
  const deleteRaviAfterStop = await apiReq("DELETE", "/api/auth/drivers/" + d1Reg.data.user.id, null, adminToken);
  c("Delete driver with no active trip = 200", deleteRaviAfterStop.status === 200, "got " + deleteRaviAfterStop.status);

  // Ravi cannot login anymore
  const raviLoginAfterDelete = await apiReq("POST", "/api/auth/login", { email: "ravi@test.com", password: "driver123" });
  c("Deleted driver cannot login (401)", raviLoginAfterDelete.status === 401, "got " + raviLoginAfterDelete.status);

  // =============================================
  // TEST 10: Cannot delete bus with active trip
  // =============================================
  console.log("\n--- TEST 10: Cannot delete bus with active trip ---");
  const johnLogin2 = await apiReq("POST", "/api/auth/login", { email: "john@test.com", password: "driver123" });
  const johnToken2 = johnLogin2.data.token;
  await apiReq("POST", "/api/trips/start", { busId: busIds[1] }, johnToken2);

  const deleteBus1 = await apiReq("DELETE", "/api/buses/" + busIds[0], null, adminToken);
  c("Delete bus with no active trip = 200", deleteBus1.status === 200, "got " + deleteBus1.status);

  const deleteBus2Active = await apiReq("DELETE", "/api/buses/" + busIds[1], null, adminToken);
  c("Delete bus with active trip = 400", deleteBus2Active.status === 400, "got " + deleteBus2Active.status);
  c("Error mentions active trip", deleteBus2Active.data.message && deleteBus2Active.data.message.toLowerCase().includes("active trip"), "got: " + deleteBus2Active.data.message);

  // Stop John's trip, then delete bus
  await apiReq("POST", "/api/trips/stop", {}, johnToken2);
  const deleteBus2After = await apiReq("DELETE", "/api/buses/" + busIds[1], null, adminToken);
  c("Delete bus after trip stopped = 200", deleteBus2After.status === 200, "got " + deleteBus2After.status);

  // =============================================
  // TEST 11: Edit driver
  // =============================================
  console.log("\n--- TEST 11: Edit driver ---");
  const editJohn = await apiReq("PUT", "/api/auth/drivers/" + d2Reg.data.user.id, {
    name: "John Updated", email: "john.new@test.com", phone: "+919999999999"
  }, adminToken);
  c("Edit driver returns updated data (200)", editJohn.status === 200, "got " + editJohn.status);
  c("Name updated", editJohn.data.user && editJohn.data.user.name === "John Updated", "got " + (editJohn.data.user && editJohn.data.user.name));
  c("Email updated", editJohn.data.user && editJohn.data.user.email === "john.new@test.com");

  // =============================================
  // TEST 12: Edit bus
  // =============================================
  console.log("\n--- TEST 12: Edit bus ---");
  const editBus = await apiReq("PUT", "/api/buses/" + busIds[2], {
    busNumber: "Bus 3 Updated", routeName: "New Route"
  }, adminToken);
  c("Edit bus returns updated data (200)", editBus.status === 200, "got " + editBus.status);
  c("Bus number updated", editBus.data.bus && editBus.data.bus.busNumber === "Bus 3 Updated", "got " + (editBus.data.bus && editBus.data.bus.busNumber));

  // =============================================
  // TEST 13: Public tracking works (no auth)
  // =============================================
  console.log("\n--- TEST 13: Public tracking (no auth needed) ---");
  const pubBuses = await apiReq("GET", "/api/public/buses");
  c("Public buses (200, no auth)", pubBuses.status === 200, "got " + pubBuses.status);

  const pubTrips = await apiReq("GET", "/api/public/trips/active");
  c("Public active trips (200)", pubTrips.status === 200, "got " + pubTrips.status);

  const pubLoc = await apiReq("GET", "/api/public/location/" + busIds[2]);
  c("Public location (200)", pubLoc.status === 200, "got " + pubLoc.status);

  // =============================================
  // TEST 14: Cross-role protection
  // =============================================
  console.log("\n--- TEST 14: Cross-role protection ---");
  const adminOnDriver = await apiReq("GET", "/api/trips/my-trip", null, adminToken);
  c("ADMIN on driver endpoint = 403", adminOnDriver.status === 403, "got " + adminOnDriver.status);

  const driverOnUsers = await apiReq("GET", "/api/auth/users", null, johnToken2);
  c("DRIVER on admin endpoint = 403", driverOnUsers.status === 403, "got " + driverOnUsers.status);

  // =============================================
  // TEST 15: Admin bootstrap (no second admin)
  // =============================================
  console.log("\n--- TEST 15: Public ADMIN registration allowed (bootstrap) ---");
  const secondAdmin = await apiReq("POST", "/api/auth/register", {
    name: "Admin2", email: "admin2@test.com", password: "admin123", role: "ADMIN"
  });
  c("Second admin registration allowed (201)", secondAdmin.status === 201, "got " + secondAdmin.status);

  // =============================================
  // SUMMARY
  // =============================================
  console.log("\n========================================");
  console.log("RESULTS: " + pass + " passed, " + fail + " failed");
  console.log("========================================");
  if (fail === 0) console.log("ALL TESTS PASSED");
  else console.log("SOME TESTS FAILED");

  process.exit(fail > 0 ? 1 : 0);
})();
