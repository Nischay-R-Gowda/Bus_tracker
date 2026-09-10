const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "database.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class JsonDatabase {
  constructor() {
    this.data = this._load();
  }

  _load() {
    let data;
    try {
      if (fs.existsSync(dbPath)) {
        data = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
      } else {
        data = null;
      }
    } catch (err) {
      console.error("Database load error:", err);
      data = null;
    }

    // Ensure all required keys exist (handles legacy DB files)
    const defaults = {
      users: [],
      buses: [],
      trips: [],
      locations: [],
      routes: [],
      _counters: { users: 0, buses: 0, trips: 0, locations: 0, routes: 0 },
    };
    if (!data) data = defaults;
    else {
      for (const key of Object.keys(defaults)) {
        if (!(key in data)) data[key] = defaults[key];
      }
      // Ensure _counters has all counters
      for (const k of Object.keys(defaults._counters)) {
        if (!(k in data._counters)) data._counters[k] = 0;
      }
      // Backfill: ensure counter for any existing rows
      for (const table of ["users", "buses", "trips", "locations", "routes"]) {
        if (Array.isArray(data[table]) && data[table].length > 0) {
          const maxId = Math.max(...data[table].map(r => r.id || 0));
          if ((data._counters[table] || 0) < maxId) data._counters[table] = maxId;
        }
      }
    }
    return data;
  }

  _save() {
    fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  _nextId(table) {
    this.data._counters[table]++;
    return this.data._counters[table];
  }

  findUserByEmail(email) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  findUserById(id) {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
  }

  createUser(user) {
    const id = this._nextId("users");
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    this.data.users.push({
      id,
      name: user.name,
      email: user.email,
      password: hashedPassword,
      role: user.role.toUpperCase(),
      phone: user.phone || null,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this._save();
    return id;
  }

  getUserById(id) {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
  }

  updateUser(id, updates) {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    const allowed = ["name", "email", "phone", "status", "password"];
    for (const key of Object.keys(updates)) {
      if (allowed.includes(key)) {
        if (key === "password") {
          user.password = bcrypt.hashSync(updates[key], 10);
        } else {
          user[key] = updates[key];
        }
      }
    }
    user.updatedAt = new Date().toISOString();
    this._save();
    return this.getUserById(id);
  }

  deleteUser(id) {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    this._save();
    return true;
  }

  getAllUsers() {
    return this.data.users.map(({ password, ...rest }) => rest);
  }

  createBus(bus) {
    const id = this._nextId("buses");
    this.data.buses.push({
      id,
      busNumber: bus.busNumber,
      registration: bus.registration || null,
      routeName: bus.routeName || null,
      status: bus.status || "INACTIVE",
      driverId: bus.driverId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this._save();
    return id;
  }

  getAllBuses() {
    return this.data.buses.map((bus) => {
      const driver = bus.driverId ? this.data.users.find((u) => u.id === bus.driverId) : null;
      return { ...bus, driverName: driver ? driver.name : null, driverPhone: driver ? driver.phone : null };
    });
  }

  getBusById(id) {
    const bus = this.data.buses.find((b) => b.id === id);
    if (!bus) return null;
    const driver = bus.driverId ? this.data.users.find((u) => u.id === bus.driverId) : null;
    return { ...bus, driverName: driver ? driver.name : null, driverPhone: driver ? driver.phone : null };
  }

  getBusByIdNumber(busNumber) {
    return this.data.buses.find((b) => b.busNumber === busNumber) || null;
  }

  updateBus(id, updates) {
    const bus = this.data.buses.find((b) => b.id === id);
    if (!bus) return null;
    const allowed = ["busNumber", "registration", "routeName", "status", "driverId"];
    for (const key of Object.keys(updates)) {
      if (allowed.includes(key)) bus[key] = updates[key];
    }
    bus.updatedAt = new Date().toISOString();
    this._save();
    return this.getBusById(id);
  }

  deleteBus(id) {
    const idx = this.data.buses.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    this.data.buses.splice(idx, 1);
    this._save();
    return true;
  }

  getBusesByDriver(driverId) {
    const buses = this.data.buses.filter((b) => b.driverId === driverId);
    return buses.map(bus => {
      const driver = bus.driverId ? this.data.users.find((u) => u.id === bus.driverId) : null;
      return { ...bus, driverName: driver ? driver.name : null, driverPhone: driver ? driver.phone : null };
    });
  }

  hasUserActiveTrip(userId) {
    return this.data.trips.some(t => t.driverId === userId && t.status === "ACTIVE");
  }

  createTrip(trip) {
    const id = this._nextId("trips");
    this.data.trips.push({
      id,
      busId: trip.busId,
      driverId: trip.driverId,
      startTime: new Date().toISOString(),
      endTime: null,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });
    this._save();
    return id;
  }

  getActiveTripByBus(busId) {
    return this.data.trips.find((t) => t.busId === busId && t.status === "ACTIVE") || null;
  }

  getActiveTripByDriver(driverId) {
    return this.data.trips.find((t) => t.driverId === driverId && t.status === "ACTIVE") || null;
  }

  hasActiveTrip(busId) {
    return this.data.trips.some(t => t.busId === busId && t.status === "ACTIVE");
  }

  endTrip(tripId) {
    const trip = this.data.trips.find((t) => t.id === tripId);
    if (trip) {
      trip.endTime = new Date().toISOString();
      trip.status = "COMPLETED";
      this._save();
    }
  }

  getAllTrips() {
    return this.data.trips.map((trip) => {
      const bus = this.data.buses.find((b) => b.id === trip.busId);
      const driver = this.data.users.find((u) => u.id === trip.driverId);
      return {
        ...trip,
        busNumber: bus ? bus.busNumber : "Unknown",
        routeName: bus ? bus.routeName : null,
        driverName: driver ? driver.name : "Unknown",
      };
    });
  }

  saveLocation(location) {
    const id = this._nextId("locations");
    this.data.locations.push({
      id,
      busId: location.busId,
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed || null,
      heading: location.heading || null,
      accuracy: location.accuracy || null,
      timestamp: location.timestamp,
      createdAt: new Date().toISOString(),
    });
    this._save();
    return id;
  }

  getLatestLocation(busId) {
    const busLocations = this.data.locations.filter((l) => l.busId === busId);
    if (busLocations.length === 0) return null;
    busLocations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return busLocations[0];
  }

  getLocationHistory(busId, limit = 100) {
    const busLocations = this.data.locations.filter((l) => l.busId === busId);
    busLocations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return busLocations.slice(0, limit);
  }

  // ==================== ROUTES ====================

  createRoute(route) {
    const id = this._nextId("routes");
    this.data.routes.push({
      id,
      name: route.name,
      description: route.description || "",
      stops: route.stops || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this._save();
    return id;
  }

  getAllRoutes() {
    return this.data.routes;
  }

  getRouteById(id) {
    return this.data.routes.find((r) => r.id === id) || null;
  }

  updateRoute(id, updates) {
    const route = this.data.routes.find((r) => r.id === id);
    if (!route) return null;
    const allowed = ["name", "description", "stops"];
    for (const key of Object.keys(updates)) {
      if (allowed.includes(key)) route[key] = updates[key];
    }
    route.updatedAt = new Date().toISOString();
    this._save();
    return this.getRouteById(id);
  }

  deleteRoute(id) {
    const idx = this.data.routes.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.data.routes.splice(idx, 1);
    this._save();
    return true;
  }
}

const db = new JsonDatabase();

// Export bcrypt instance so other modules share the same one
module.exports = db;
module.exports._bcrypt = bcrypt;
