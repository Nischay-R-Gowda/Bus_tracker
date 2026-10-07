package com.iiitdharwad.bustracker.ui.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.iiitdharwad.bustracker.data.model.LocationPoint
import com.iiitdharwad.bustracker.service.GpsForegroundService
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

@Composable
fun TrackingScreen(
    viewModel: TrackingViewModel,
    onTripEnded: () -> Unit
) {
    val ui by viewModel.ui.collectAsState()
    val context = LocalContext.current
    var mapView by remember { mutableStateOf<MapView?>(null) }
    var busMarker by remember { mutableStateOf<Marker?>(null) }
    var movementReceiver by remember { mutableStateOf<BroadcastReceiver?>(null) }
    var showEndConfirm by remember { mutableStateOf(false) }

    // Setup OSMDroid
    LaunchedEffect(Unit) {
        Configuration.getInstance().load(
            context,
            context.getSharedPreferences("osmdroid", android.content.Context.MODE_PRIVATE)
        )
        Configuration.getInstance().userAgentValue = "BusTrackerDriver/1.0"
    }

    // Listen for movement updates from service via broadcast
    DisposableEffect(context) {
        movementReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                if (intent?.action == GpsForegroundService.ACTION_MOVEMENT_UPDATE) {
                    val status = intent.getStringExtra(GpsForegroundService.EXTRA_MOVEMENT_STATUS)
                        ?: "STARTING"
                    viewModel.updateMovementStatus(status)
                }
            }
        }
        val filter = IntentFilter(GpsForegroundService.ACTION_MOVEMENT_UPDATE)
        context.registerReceiver(movementReceiver, filter)
        onDispose {
            try { context.unregisterReceiver(movementReceiver) } catch (e: Exception) {}
            movementReceiver = null
        }
    }

    // Update map with new location
    LaunchedEffect(ui.latestLocation) {
        val loc = ui.latestLocation ?: return@LaunchedEffect
        mapView?.let { map ->
            val geoPoint = GeoPoint(loc.latitude, loc.longitude)
            if (busMarker == null) {
                busMarker = Marker(map).apply {
                    position = geoPoint
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                    title = ui.busNumber
                }
                map.overlays.add(busMarker)
            } else {
                busMarker?.position = geoPoint
            }
            map.controller.animateTo(geoPoint)
            map.controller.setZoom(16.0)
        }
    }

    // Handle trip ended (from backend or end trip button)
    LaunchedEffect(ui.tripEnded) {
        if (ui.tripEnded) {
            try { context.unregisterReceiver(movementReceiver) } catch (e: Exception) {}
            movementReceiver = null
            mapView?.onDetach()
            mapView = null
            busMarker = null
            onTripEnded()
        }
    }

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.DirectionsBus, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.padding(start = 8.dp))
                    Text("Tracking: ${ui.busNumber}", style = MaterialTheme.typography.titleMedium)
                }
                MovementBadge(status = ui.movementStatus)
            }

            // Map
            Card(
                modifier = Modifier.fillMaxWidth().height(280.dp).padding(horizontal = 16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                AndroidView(
                    factory = {
                        MapView(context).also { map ->
                            map.setTileSource(TileSourceFactory.MAPNIK)
                            map.setMultiTouchControls(true)
                            map.controller.setZoom(13.0)
                            mapView = map
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }

            // Content area: pre-trip controls or post-trip stats
            if (!ui.tripStarted) {
                PreTripControls(
                    ui = ui,
                    onStartTrip = { viewModel.startTrip(context) }
                )
            } else {
                PostTripStats(
                    ui = ui,
                    onEndTrip = { showEndConfirm = true }
                )
            }
        }
    }

    // End trip confirmation dialog
    if (showEndConfirm) {
        AlertDialog(
            onDismissRequest = { showEndConfirm = false },
            title = { Text("End Trip?") },
            text = { Text("This will stop tracking for ${ui.busNumber}. Students will no longer see live location.") },
            confirmButton = {
                Button(
                    onClick = {
                        showEndConfirm = false
                        viewModel.endTrip(context)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("End Trip")
                }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { showEndConfirm = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun PreTripControls(
    ui: com.iiitdharwad.bustracker.ui.tracking.TrackingUiState,
    onStartTrip: () -> Unit
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Ready to Start Trip", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Bus: ${ui.busNumber}", style = MaterialTheme.typography.bodyMedium)
                Text(
                    "Tap below to start tracking. GPS will activate once the trip begins.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }

        Button(
            onClick = onStartTrip,
            modifier = Modifier.fillMaxWidth(),
            enabled = !ui.startingTrip
        ) {
            if (ui.startingTrip) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
                Spacer(modifier = Modifier.padding(horizontal = 8.dp))
                Text("Starting Trip…")
            } else {
                Text("Start Trip")
            }
        }

        ui.error?.let { err ->
            Text(
                text = err,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun PostTripStats(
    ui: com.iiitdharwad.bustracker.ui.tracking.TrackingUiState,
    onEndTrip: () -> Unit
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        StatRow("Bus", ui.busNumber)
        StatRow("Latitude", ui.latestLocation?.let { "%.6f".format(it.latitude) } ?: "—")
        StatRow("Longitude", ui.latestLocation?.let { "%.6f".format(it.longitude) } ?: "—")
        StatRow("Speed", formatSpeed(ui.latestLocation))
        StatRow("Accuracy", formatAccuracy(ui.latestLocation))
        StatRow("Updates Sent", ui.updatesSent.toString())
        StatRow("Last Update", ui.lastUpdateTime.ifBlank { "—" })

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = onEndTrip,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
        ) {
            Text("End Trip")
        }

        ui.error?.let { err ->
            Text(
                text = err,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
            )
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

private fun formatSpeed(loc: LocationPoint?): String {
    if (loc == null) return "—"
    val spd = loc.speed ?: 0.0
    return if (spd > 0) "${(spd * 3.6).toInt()} km/h" else "0 km/h"
}

private fun formatAccuracy(loc: LocationPoint?): String {
    if (loc == null) return "N/A"
    return loc.accuracy?.let { "${it.toInt()}m" } ?: "N/A"
}

@Composable
private fun MovementBadge(status: String) {
    val (text, color) = when {
        status.startsWith("MOVING") -> "MOVING" to MaterialTheme.colorScheme.primary
        status.startsWith("STOPPED") -> status to androidx.compose.ui.graphics.Color(0xFFFF9800)
        status.startsWith("STALE") -> status to MaterialTheme.colorScheme.error
        else -> status to MaterialTheme.colorScheme.outline
    }
    Box(
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), androidx.compose.foundation.shape.RoundedCornerShape(20.dp))
            .padding(horizontal = 14.dp, vertical = 6.dp)
    ) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = color, fontWeight = FontWeight.Bold)
    }
}
