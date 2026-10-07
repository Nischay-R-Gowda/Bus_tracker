package com.iiitdharwad.bustracker.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.iiitdharwad.bustracker.BusTrackerApplication
import com.iiitdharwad.bustracker.MainActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.pow

class GpsForegroundService : Service() {

    companion object {
        const val EXTRA_BUS_ID = "extra_bus_id"
        const val EXTRA_BUS_NUMBER = "extra_bus_number"
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "gps_tracking_channel"
        const val ACTION_MOVEMENT_UPDATE = "com.iiitdharwad.bustracker.MOVEMENT_UPDATE"
        const val EXTRA_MOVEMENT_STATUS = "extra_movement_status"

        fun startService(context: Context, busId: Int, busNumber: String) {
            val intent = Intent(context, GpsForegroundService::class.java).apply {
                putExtra(EXTRA_BUS_ID, busId)
                putExtra(EXTRA_BUS_NUMBER, busNumber)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, GpsForegroundService::class.java)
            context.stopService(intent)
        }
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    private var busId: Int = 0
    private var busNumber: String = ""

    @Volatile private var lastSentLocation: android.location.Location? = null
    private val MIN_DISTANCE_METERS = 15f
    private val MIN_INTERVAL_SECONDS = 10L

    private val recentGpsReadings = mutableListOf<GpsReading>()
    private val STOP_THRESHOLD_SECONDS = 120L
    private val STALE_THRESHOLD_SECONDS = 90L
    private val MOVEMENT_THRESHOLD_MPS = 0.5
    private var movementEvalJob: Job? = null
    private var currentMovementStatus: String = "STARTING"

    private val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
    private var postJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.lastOrNull()?.let { handleLocation(it) }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        busId = intent?.getIntExtra(EXTRA_BUS_ID, 0) ?: 0
        busNumber = intent?.getStringExtra(EXTRA_BUS_NUMBER) ?: "Bus"

        if (busId == 0) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification("Starting GPS…"))
        startLocationUpdates()
        startMovementEvaluation()

        Log.d("GpsService", "Service started for bus $busId")
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        stopLocationUpdates()
        stopMovementEvaluation()
        postJob?.cancel()
        movementEvalJob?.cancel()
        serviceScope.cancel()
        Log.d("GpsService", "Service destroyed")
    }

    override fun onBind(intent: Intent): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "GPS Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows live GPS tracking status"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(status: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val suffix = when {
            currentMovementStatus.startsWith("STOPPED") -> " • STOPPED"
            currentMovementStatus.startsWith("STALE") -> " • STALE"
            currentMovementStatus == "MOVING" -> " • MOVING"
            else -> ""
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Tracking: $busNumber")
            .setContentText(status + suffix)
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun updateNotification(status: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(status))
    }

    private fun broadcastMovement(status: String) {
        val intent = Intent(ACTION_MOVEMENT_UPDATE).apply {
            putExtra(EXTRA_MOVEMENT_STATUS, status)
        }
        sendBroadcast(intent)
    }

    private fun startLocationUpdates() {
        try {
            val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L)
                .setMinUpdateIntervalMillis(10_000L)
                .setMinUpdateDistanceMeters(MIN_DISTANCE_METERS)
                .setWaitForAccurateLocation(false)
                .build()
            fusedLocationClient.requestLocationUpdates(request, locationCallback, mainLooper)
        } catch (e: SecurityException) {
            Log.e("GpsService", "Location permission denied", e)
            stopSelf()
        }
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    private fun handleLocation(location: Location) {
        val lat = location.latitude
        val lng = location.longitude
        if (lat == 0.0 && lng == 0.0) return
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return

        val speedMs = location.speed
        val speedKmh = if (speedMs >= 0) speedMs * 3.6 else null
        val heading = if (location.bearing >= 0) location.bearing.toDouble() else null
        val timestamp = dateFormat.format(Date(location.time))

        synchronized(recentGpsReadings) {
            recentGpsReadings.add(GpsReading(location.time, speedMs, lat, lng))
            val cutoff = location.time - (STALE_THRESHOLD_SECONDS * 2000)
            recentGpsReadings.removeAll { it.timestamp < cutoff }
        }

        val shouldSend = shouldSendUpdate(
            lastSentLocation?.latitude,
            lastSentLocation?.longitude,
            lat, lng,
            lastSentLocation?.time,
            MIN_DISTANCE_METERS.toDouble(),
            MIN_INTERVAL_SECONDS
        )

        if (shouldSend) {
            postLocation(busId, lat, lng, speedKmh, heading, location.accuracy, timestamp)
            lastSentLocation = location
        }
    }

    private fun postLocation(
        busId: Int, lat: Double, lng: Double,
        speedKmh: Double?, heading: Double?, accuracy: Float?, timestamp: String
    ) {
        postJob?.cancel()
        postJob = serviceScope.launch {
            try {
                val repo = BusTrackerApplication.apiRepository
                if (repo == null) {
                    Log.w("GpsService", "Repository not initialized")
                    return@launch
                }
                repo.sendLocation(busId, lat, lng, speedKmh, heading, accuracy, timestamp)
                    .onSuccess {
                        Log.d("GpsService", "Location posted: $lat, $lng")
                    }
                    .onFailure { Log.w("GpsService", "Post failed: ${it.message}") }
            } catch (e: Exception) {
                Log.w("GpsService", "Post exception: ${e.message}")
            }
        }
    }

    private fun shouldSendUpdate(
        lastLat: Double?, lastLng: Double?, newLat: Double, newLng: Double,
        lastTimestamp: Long?, minDist: Double, minInterval: Long
    ): Boolean {
        if (lastLat == null || lastLng == null || lastTimestamp == null) return true
        val dist = haversineDistance(lastLat, lastLng, newLat, newLng)
        val elapsed = (System.currentTimeMillis() - lastTimestamp) / 1000
        return dist >= minDist || elapsed >= minInterval
    }

    private fun haversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val toRad = Math.PI / 180.0
        val dLat = (lat2 - lat1) * toRad
        val dLon = (lon2 - lon1) * toRad
        val a = kotlin.math.sin(dLat / 2).pow(2.0) +
                kotlin.math.cos(lat1 * toRad) * kotlin.math.cos(lat2 * toRad) *
                kotlin.math.sin(dLon / 2).pow(2.0)
        return 6371_000.0 * 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1.0 - a))
    }

    private fun startMovementEvaluation() {
        movementEvalJob?.cancel()
        movementEvalJob = serviceScope.launch {
            while (true) {
                delay(5000)
                evaluateMovementStatus()
            }
        }
    }

    private fun stopMovementEvaluation() {
        movementEvalJob?.cancel()
        movementEvalJob = null
        synchronized(recentGpsReadings) { recentGpsReadings.clear() }
    }

    private fun evaluateMovementStatus() {
        val now = System.currentTimeMillis()
        val readings: List<GpsReading>

        synchronized(recentGpsReadings) {
            if (recentGpsReadings.isEmpty()) {
                currentMovementStatus = "ACQUIRING GPS…"
                updateNotification("Acquiring GPS…")
                broadcastMovement(currentMovementStatus)
                return
            }
            readings = recentGpsReadings.toList()
        }

        val newest = readings.last()
        val timeSinceLast = (now - newest.timestamp) / 1000

        if (timeSinceLast > STALE_THRESHOLD_SECONDS) {
            val mins = kotlin.math.floor(timeSinceLast / 60.0).toInt()
            currentMovementStatus = "STALE • ${mins} min"
            updateNotification("Stale (${mins}m)")
            broadcastMovement(currentMovementStatus)
            return
        }

        val windowStart = now - STOP_THRESHOLD_SECONDS * 1000
        val windowReadings = readings.filter { it.timestamp >= windowStart }

        if (windowReadings.size >= 2) {
            val first = windowReadings.first()
            val last = windowReadings.last()
            val maxSpeed = windowReadings.maxOf { it.speed }
            val distance = haversineDistance(first.lat, first.lng, last.lat, last.lng)

            if (maxSpeed < MOVEMENT_THRESHOLD_MPS && distance < 5.0) {
                val stoppedSec = ((now - first.timestamp) / 1000).toInt()
                val mins = stoppedSec / 60
                val secs = stoppedSec % 60
                val duration = if (mins > 0) "${mins} min" else "${secs}s"
                currentMovementStatus = "STOPPED • $duration"
                updateNotification("Stopped ($duration)")
                broadcastMovement(currentMovementStatus)
                return
            }
        }

        if (currentMovementStatus != "MOVING") {
            currentMovementStatus = "MOVING"
            updateNotification("Moving")
            broadcastMovement(currentMovementStatus)
        }
    }

    fun getCurrentMovementStatus(): String = currentMovementStatus

    data class GpsReading(val timestamp: Long, val speed: Float, val lat: Double, val lng: Double)
}
