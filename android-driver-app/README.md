# Android Driver App — Bus Tracker

Native Android app for bus drivers to track their location in real-time using the existing Bus Tracker backend.

## Architecture

- **Kotlin + Jetpack Compose** — Single Activity, 3 screens (Login → Bus Selection → Tracking)
- **Foreground Service** — Continuous background GPS tracking with persistent notification
- **FusedLocationProviderClient** — High-accuracy location, 15m / 10s throttling
- **Retrofit + OkHttp** — REST API calls to existing Node.js backend
- **Socket.IO** — Real-time trip status events
- **OSMDroid** — Offline-capable OpenStreetMap rendering
- **DataStore** — JWT token persistence
- **BroadcastReceiver** — Movement status (MOVING/STOPPED/STALE) from service → UI

## Backend Compatibility

This app uses the **existing backend** at port 3001 — no server changes needed:

| Endpoint | Usage |
|----------|-------|
| `POST /api/auth/login` | Driver login |
| `GET /api/buses` | List available buses |
| `POST /api/trips/start` | Start a tracking trip |
| `POST /api/trips/stop` | End the trip |
| `GET /api/trips/my-trip` | Check active trip (resume on app restart) |
| `POST /api/location/update` | Send GPS coordinates |
| `GET /api/public/routes` | Load route stops for map |
| Socket: `driver:join-bus(busId)` | Join bus room for real-time events |
| Socket: `location:update` | Receive location broadcasts |
| Socket: `trip:status` | Receive trip status changes |

JWT Secret: `bus-tracker-secret-key-2024` | Expiry: 7 days

## Project Structure

```
android-driver-app/
├── app/
│   ├── build.gradle.kts              # Dependencies & config
│   ├── proguard-rules.pro            # Release obfuscation
│   └── src/main/
│       ├── AndroidManifest.xml       # Permissions & service
│       ├── res/                       # Android resources
│       └── java/com/iiitdharwad/bustracker/
│           ├── BusTrackerApplication.kt   # App class, singleton holder
│           ├── MainActivity.kt            # Entry point, composes NavGraph
│           ├── NavGraph.kt                # Navigation (login → bus → tracking)
│           ├── data/
│           │   ├── model/                 # Data classes (7 files)
│           │   ├── local/TokenManager.kt  # JWT in DataStore
│           │   └── repository/
│           │       ├── ApiRepository.kt   # Retrofit REST calls
│           │       └── SocketManager.kt   # Socket.IO singleton
│           ├── service/
│           │   └── GpsForegroundService.kt # GPS + posting + movement detection
│           └── ui/
│               ├── theme/Theme.kt
│               ├── login/LoginScreen.kt + LoginViewModel.kt
│               ├── busselection/BusSelectionScreen.kt + BusSelectionViewModel.kt
│               └── tracking/TrackingScreen.kt + TrackingViewModel.kt
├── build.gradle
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
└── gradle/wrapper/gradle-wrapper.properties
```

## Build Instructions

### Prerequisites
- Android Studio Giraffe (2022.3.1) or newer
- JDK 11
- Android SDK API 35
- Backend server running at port 3001

### Steps
1. Open `android-driver-app/` in Android Studio
2. Sync Gradle (auto-downloads dependencies)
3. Update `MainActivity.kt` line 32: change `"http://10.0.2.2:3001"` to your backend IP
4. Build → Build APK(s) or run `./gradlew assembleDebug`

## Permissions Required

| Permission | Why | Android Version |
|------------|-----|-----------------|
| `INTERNET` | API calls to backend | All |
| `ACCESS_FINE_LOCATION` | GPS tracking | All |
| `ACCESS_COARSE_LOCATION` | Fallback location | All |
| `ACCESS_BACKGROUND_LOCATION` | Tracking when app closed | API 29+ |
| `POST_NOTIFICATIONS` | Show tracking notification | API 33+ |
| `FOREGROUND_SERVICE` | Run GPS in background | All |
| `FOREGROUND_SERVICE_LOCATION` | Location foreground service | API 34+ |

## Installation

```bash
# Build
cd android-driver-app
./gradlew assembleDebug

# Install on connected device
adb install app/build/outputs/apk/debug/app-debug.apk

# Or via Android Studio: Run → app
```

## Usage Flow

1. **Login** — Enter driver credentials (email/password) or tap "Skip — Demo Mode"
2. **Select Bus** — Choose a bus from the list (only ACTIVE/AVAILABLE buses shown)
3. **Start Tracking** — Begins GPS tracking, appears as persistent notification
4. **Background Operation** — App can be closed; GPS continues via Foreground Service
5. **End Trip** — Tap button in tracking screen; service stops, trip ends on server

## Movement Detection Logic

Mirrors the web implementation exactly:

| Status | Condition | Badge Color |
|--------|-----------|-------------|
| ACQUIRING GPS… | No GPS readings yet | Gray |
| MOVING | Updates within 90s AND (max speed ≥ 0.5 m/s OR displacement ≥ 5m in 120s window) | Cyan |
| STOPPED | Updates within 90s AND max speed < 0.5 m/s AND displacement < 5m over 120s | Orange + duration |
| STALE | No GPS update for > 90s | Red + minutes stale |

## End-to-End Test Scenario

1. Start backend: `cd bus_tracker && npm start`
2. Install driver APK on device/emulator
3. Login as driver: `driver@test.com` / `driver123` (or use seed endpoint)
4. Select bus → Start Tracking
5. **Verify**: Persistent notification shows "Tracking: Bus X • MOVING"
6. Walk around → badge shows "MOVING"
7. Stop moving → badge shows "STOPPED • 1 min"
8. Open student web at `http://localhost:3000/student/track.html`
9. **Verify**: Student sees live bus location, movement status, speed
10. Open another tab at driver web dashboard
11. **Verify**: Both student and driver web show same coordinates
12. Tap "End Trip" in Android app
13. **Verify**: Notification gone, bus shows OFFLINE on student web

## Configuration

Edit `MainActivity.kt` to change the backend URL:
```kotlin
// For emulator:
backendUrl = "http://10.0.2.2:3001"

// For real device (same WiFi):
backendUrl = "http://192.168.x.x:3001"
```

## Limitations

- GPS accuracy depends on device hardware and environmental conditions
- Background location may be restricted on some OEMs (Xiaomi, Huawei) with aggressive battery optimization
- Socket.IO reconnection may take 5-10 seconds after network loss
- Location update frequency throttled to 10s minimum (matches web behavior)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot reach server" | Ensure backend is running at correct IP, check firewall |
| GPS not updating | Enable high-accuracy mode in device settings |
| Background tracking stops | Disable battery optimization for the app |
| "Permission denied" | Grant all location permissions in app settings |
| No map tiles | Check internet connection (OSM tiles download) |
