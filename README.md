# College Bus Live Tracking System

## Phase 1 Complete — Backend Foundation

### What's Working

- **User Authentication**: Register/Login with JWT tokens and bcrypt password hashing
- **Role-Based Access**: ADMIN, DRIVER, STUDENT roles with proper access control
- **Bus Management**: CRUD operations for buses with driver assignment
- **Trip Management**: Start/stop trips, one active trip per driver
- **Location Storage**: Save and retrieve GPS coordinates with validation
- **Real-Time Socket.IO**: WebSocket server broadcasting location updates and trip status
- **Location Freshness**: Timestamps show LIVE/AGING/STALE status
- **Coordinate Validation**: Rejects invalid lat/lng values

### How to Run

```bash
cd bus_tracker
npm install
npm start
```

Server runs at `http://localhost:3001`

### Test Accounts

1. Register 3 accounts via `/api/auth/register` with roles: ADMIN, DRIVER, STUDENT
2. Or run the test suite: `node test-phase1.js` (server must be running first)

### Project Structure

```
bus_tracker/
├── server.js                    # Express + Socket.IO server
├── package.json                 # Dependencies
├── test-phase1.js               # 81 automated tests
├── database/
│   └── db.js                    # JSON file database
├── middleware/
│   ├── auth.js                  # JWT authentication
│   └── roleCheck.js             # Role-based access control
├── routes/
│   ├── auth.js                  # Register/Login/Profile
│   ├── buses.js                 # Bus CRUD
│   ├── trips.js                 # Start/Stop trips
│   └── location.js              # Location update/retrieve
├── utils/
│   └── gps.js                   # Haversine, validation, throttling
├── socket/
│   └── index.js                 # Socket.IO rooms & broadcasting
└── public/
    ├── index.html               # Role selection landing page
    ├── login.html               # Login/Register
    ├── css/style.css            # Responsive styles
    ├── driver/dashboard.html    # Driver GPS dashboard
    ├── student/track.html       # Student live tracking
    └── admin/dashboard.html     # Admin management panel
```

### Tech Stack (All Free)

- Express.js — Backend server
- Socket.IO — Real-time location broadcasting
- JSON file database — Zero-dependency data storage
- bcryptjs — Password hashing
- jsonwebtoken — Authentication tokens
- Leaflet.js — Interactive maps (via CDN)
- OpenStreetMap — Free map tiles
- Vanilla HTML/CSS/JS — No frontend framework needed

### Next Steps (Phase 2-4)

1. Wire up Socket.IO in driver dashboard (emit location updates)
2. Wire up Socket.IO in student tracking page (listen for map updates)
3. Add `utils/gps.js` import to driver tracker for smart throttling
4. Test end-to-end: driver sends GPS → student sees moving marker
