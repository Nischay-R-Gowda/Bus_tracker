const token = getToken();
    const user = getCurrentUser();
    let allBuses = [];
    let selectedBusId = null;
    let watchId = null;
    let currentTrip = null;
    let updatesSentCount = 0;
    let lastSentLocation = null;
    let driverMap = null;
    let driverMarker = null;
    let socket = null;

    const MIN_DISTANCE_METERS = 15;
    const MIN_INTERVAL_SECONDS = 10;

    // ==================== INIT ====================
    if (!requireAuth("DRIVER")) throw new Error("Not authenticated");                                                             

    document.getElementById("userName").textContent = `${user.name} (Driver)`;
    document.getElementById("driverName").textContent = user.name;
    document.getElementById("driverEmail").textContent = user.email;
    document.getElementById("driverPhone").textContent = user.phone || "Not provided";
    document.getElementById("driverRole").textContent = user.role;

    loadBuses();
    checkActiveTrip();

    // ==================== LOGOUT ====================
    function handleLogout() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    if (socket) {
        socket.disconnect();
        socket = null;
    }

    if (driverMap) {
        driverMap.remove();
        driverMap = null;
        driverMarker = null;
    }

    logout("/");
}

    // ==================== LOAD ALL BUSES ====================
    async function loadBuses() {
      try {
         const result = await apiCall("/api/buses");

        console.log("API RESULT:", result);
        console.log("STATUS:", result.status);
        console.log("DATA:", result.data);
        console.log("BUSES:", result.data?.buses);

        if (result.status === 200 && result.data?.buses) {
            allBuses = result.data.buses;

            console.log("Calling renderBusSelector...");
            renderBusSelector();
            console.log("renderBusSelector finished");
        } else {
            console.error("Unexpected API response:", result);

            document.getElementById("busSelectorGrid").innerHTML =
                `<p style="color:var(--error);text-align:center;">
                    Failed to load buses 1 (${result.status})
                </p>`;
        }
      } catch (err) {
        document.getElementById("busSelectorGrid").innerHTML =
          '<p style="color:var(--error);text-align:center;">Failed to load buses5.</p>';
      }
    }

    function renderBusSelector() {
      const grid = document.getElementById("busSelectorGrid");
      if (allBuses.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;">No buses available. Contact admin.</p>';
        return;
      }

      grid.innerHTML = allBuses.map(bus => {
        const statusClass = bus.status === "ACTIVE" ? "active" : "inactive";
        const statusText = bus.status === "ACTIVE" ? "Active" : "Available";
        return `
          <div class="bus-select-card" id="bus-card-${bus.id}" onclick="selectBus(${bus.id})">
            <div class="bus-icon">&#128652;</div>
            <div class="bus-number">${escapeHtml(bus.busNumber)}</div>
            <div class="bus-route">${escapeHtml(bus.routeName || "No route")}</div>
            <div class="bus-status ${statusClass}">${statusText}</div>
          </div>
        `;
      }).join("");
    }

    function selectBus(busId) {
      // Deselect previous
      if (selectedBusId !== null) {
        const prev = document.getElementById("bus-card-" + selectedBusId);
        if (prev) prev.classList.remove("selected");
      }
      selectedBusId = busId;
      const card = document.getElementById("bus-card-" + busId);
      if (card) card.classList.add("selected");

      const bus = allBuses.find(b => b.id === busId);
      document.getElementById("selectedBusLabel").textContent =
        bus ? `Selected: ${bus.busNumber}` : "";
      document.getElementById("startTrackingBtn").disabled = false;
    }

    // ==================== START TRACKING ====================
    async function startTracking() {
      if (!selectedBusId) return;

      hideError("startError");
      const btn = document.getElementById("startTrackingBtn");
      btn.disabled = true;
      btn.textContent = "Starting...";

      try {
        // 1. Create the trip
        const { status, data } = await apiCall("/api/trips/start", {
          method: "POST",
          body: JSON.stringify({ busId: selectedBusId }),
        });

        if (status !== 201) {
          showError("startError", data.message || "Failed to start trip.");
          btn.disabled = false;
          btn.textContent = "Start Tracking";
          return;
        }

        currentTrip = data.trip;

        // 2. Show tracking UI
        document.getElementById("busSelectorCard").classList.add("hidden");
        document.getElementById("trackingCard").classList.remove("hidden");

        // 3. Init map
        initDriverMap();

        // 4. Connect socket
        connectSocket();

        // 5. Start GPS
        startGPS();

      } catch (err) {
        console.error("Start tracking error:", err);
        showError("startError", "Network error. Please try again.");
        btn.disabled = false;
        btn.textContent = "Start Tracking";
      }
    }

    // ==================== END TRIP ====================
    async function endTrip() {
      hideError("trackingError");

      // Stop GPS
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      try {
        const { status } = await apiCall("/api/trips/stop", { method: "POST" });
        if (status === 200) {
          resetTrackingState();
        } else {
          showError("trackingError", "Failed to end trip.");
        }
      } catch (err) {
        showError("trackingError", "Network error.");
      }
    }

    function resetTrackingState() {
      currentTrip = null;
      selectedBusId = null;
      updatesSentCount = 0;
      lastSentLocation = null;

      // Reset bus selector
      document.querySelectorAll(".bus-select-card").forEach(c => c.classList.remove("selected"));
      document.getElementById("selectedBusLabel").textContent = "";
      document.getElementById("startTrackingBtn").disabled = true;
      document.getElementById("startTrackingBtn").textContent = "Start Tracking";

      // Show selector, hide tracking
      document.getElementById("trackingCard").classList.add("hidden");
      document.getElementById("busSelectorCard").classList.remove("hidden");

      if (socket) { socket.disconnect(); socket = null; }
      if (driverMap) { driverMap.remove(); driverMap = null; driverMarker = null; }
    }

    // ==================== CHECK ACTIVE TRIP ON LOAD ====================
    async function checkActiveTrip() {
      try {
        const { data } = await apiCall("/api/trips/my-trip");
        if (data.trip) {
          currentTrip = data.trip;
          selectedBusId = currentTrip.busId;
          document.getElementById("busSelectorCard").classList.add("hidden");
          document.getElementById("trackingCard").classList.remove("hidden");
          initDriverMap();
          connectSocket();
          startGPS();
          if (data.latestLocation) {
            updateLocationDisplay(data.latestLocation.latitude, data.latestLocation.longitude, data.latestLocation);
          }
        }
      } catch (err) {
        // No active trip — show bus selector
      }
    }

    // ==================== GPS TRACKING ====================
    function startGPS() {
      if (!navigator.geolocation) {
        showError("trackingError", "Geolocation is not supported by your browser.");
        return;
      }

      document.getElementById("gpsStatusText").textContent = "Acquiring GPS signal...";

      watchId = navigator.geolocation.watchPosition(
        handleGPSSuccess,
        handleGPSError,
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 5000,
        }
      );
    }

    function handleGPSSuccess(position) {
      const { latitude, longitude, accuracy, speed, heading } = position.coords;
      updateLocationDisplay(latitude, longitude, position.coords);
      updateDriverMapMarker(latitude, longitude);
      sendLocationIfNeeded(latitude, longitude, accuracy, speed, heading);
    }

    function handleGPSError(error) {
      console.error("GPS Error:", error);
      let message = "GPS error occurred.";
      if (error.code === error.PERMISSION_DENIED) {
        message = "Location permission denied. Please allow location access and refresh.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = "GPS signal unavailable. Check your device GPS settings.";
      } else if (error.code === error.TIMEOUT) {
        message = "GPS timeout. Retrying...";
      }
      document.getElementById("gpsStatusText").textContent = "GPS Error";
      showError("trackingError", message);
    }

    function updateLocationDisplay(lat, lng, coords) {
      document.getElementById("gpsStatusText").textContent = "GPS Active";
      document.getElementById("currentLat").textContent = lat.toFixed(6);
      document.getElementById("currentLng").textContent = lng.toFixed(6);
      document.getElementById("currentAccuracy").textContent = coords.accuracy ? `${coords.accuracy.toFixed(1)}m` : "N/A";
      document.getElementById("currentSpeed").textContent =
        coords.speed !== null && coords.speed !== undefined
          ? `${(coords.speed * 3.6).toFixed(1)} km/h`
          : "0 km/h";
    }

    async function sendLocationIfNeeded(lat, lng, accuracy, speed, heading) {
      if (!currentTrip) return;

      const result = shouldSendUpdate(
        lastSentLocation?.lat,
        lastSentLocation?.lng,
        lat, lng,
        lastSentLocation?.timestamp,
        MIN_DISTANCE_METERS,
        MIN_INTERVAL_SECONDS
      );

      if (!result.shouldSend) return;

      try {
        const { status } = await apiCall("/api/location/update", {
          method: "POST",
          body: JSON.stringify({
            busId: currentTrip.busId,
            latitude: lat,
            longitude: lng,
            speed: speed ? Math.round(speed * 3.6 * 10) / 10 : null,
            heading: heading || null,
            accuracy: accuracy || null,
            timestamp: new Date().toISOString(),
          }),
        });

        if (status === 201) {
          updatesSentCount++;
          document.getElementById("updatesSent").textContent = updatesSentCount;
          document.getElementById("lastUpdateTime").textContent = "Just now";

          lastSentLocation = {
            lat: lat, lng: lng,
            timestamp: new Date().toISOString(),
          };
        }
      } catch (err) {
        console.error("Failed to send location:", err);
      }
    }

    // ==================== DRIVER MAP ====================
    function initDriverMap() {
      if (driverMap) { driverMap.remove(); driverMap = null; }

      driverMap = L.map("driverMap", {
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(driverMap);

      const driverIcon = L.divIcon({
        className: "",
        html: '<div style="font-size:28px;transform:translate(-50%,-100%);filter:drop-shadow(0 3px 4px rgba(0,0,0,0.4));">&#128664;</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      driverMarker = L.marker([0, 0], { icon: driverIcon, opacity: 0 }).addTo(driverMap);
    }

    function updateDriverMapMarker(lat, lng) {
      if (!driverMarker || !driverMap) return;
      driverMarker.setLatLng([lat, lng]);
      driverMarker.setOpacity(1);
      driverMap.setView([lat, lng], 16);
    }

    // ==================== SOCKET.IO ====================
    function connectSocket() {
      if (socket) { try { socket.disconnect(); } catch(e) {} }

      socket = io({
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        if (currentTrip) {
          socket.emit("driver:join-bus", currentTrip.busId);
        }
      });

      socket.on("disconnect", () => console.log("Socket disconnected"));
      socket.on("reconnect", () => {
        if (currentTrip) socket.emit("driver:join-bus", currentTrip.busId);
      });
    }

    // ==================== UPDATE "LAST UPDATE" TEXT ====================
    setInterval(() => {
      if (!lastSentLocation) return;
      const elapsed = Math.floor((Date.now() - new Date(lastSentLocation.timestamp).getTime()) / 1000);
      const el = document.getElementById("lastUpdateTime");
      if (!el) return;
      if (elapsed < 15) el.textContent = "Just now";
      else if (elapsed < 60) el.textContent = `${elapsed}s ago`;
      else el.textContent = `${Math.floor(elapsed / 60)}m ago`;
    }, 15000);