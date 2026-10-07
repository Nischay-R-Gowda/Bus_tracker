package com.iiitdharwad.bustracker.ui.busselection

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.MultiplePermissionsState
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.iiitdharwad.bustracker.data.model.Bus
import com.iiitdharwad.bustracker.util.PermissionHelper

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun BusSelectionScreen(
    viewModel: BusSelectionViewModel,
    onNavigateToTracking: (Bus) -> Unit,
    onLogout: () -> Unit
) {
    val ui by viewModel.ui.collectAsState()

    // Location permissions state
    val locationPerms = rememberMultiplePermissionsState(
        permissions = PermissionHelper.locationPermissions()
    )
    var showPermissionRationale by remember { mutableStateOf(false) }

    // Track which bus was selected (pending permission check)
    var pendingBus by remember { mutableStateOf<Bus?>(null) }
    var awaitingPermission by remember { mutableStateOf(false) }

    // If permissions granted and we have a pending bus, navigate
    SideEffect {
        if (awaitingPermission && pendingBus != null && locationPerms.allPermissionsGranted) {
            awaitingPermission = false
            val bus = pendingBus
            pendingBus = null
            bus?.let { onNavigateToTracking(it) }
        }
    }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (ui.buses.isEmpty() && !ui.loading) {
            viewModel.loadBuses()
        }
    }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
            ) {
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Icon(Icons.Default.DirectionsBus, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.padding(start = 8.dp))
                    Text("Select Bus", style = MaterialTheme.typography.titleLarge)
                }
                OutlinedButton(onClick = onLogout) {
                    Text("Logout")
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            if (ui.error != null) {
                Text(
                    text = ui.error!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
            }

            // Permission request card when awaiting
            if (awaitingPermission) {
                PermissionRequestCard(
                    permissionsState = locationPerms,
                    onGranted = {
                        pendingBus?.let { bus ->
                            pendingBus = null
                            onNavigateToTracking(bus)
                        }
                    },
                    onRationaleShown = { showPermissionRationale = true }
                )
                if (showPermissionRationale) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Location permission is required for GPS tracking. Please grant all permissions to continue.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                }
            }

            if (ui.loading && ui.buses.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Loading buses…")
                    }
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(ui.buses) { bus ->
                        BusCard(
                            bus = bus,
                            selected = ui.selectedBus?.id == bus.id,
                            onCardClick = {
                                // Only allow selecting AVAILABLE buses
                                if (bus.status != "ACTIVE") {
                                    viewModel.selectBus(bus)
                                }
                            },
                            onStart = {
                                // Request permissions before navigating to tracking
                                if (locationPerms.allPermissionsGranted) {
                                    onNavigateToTracking(bus)
                                } else {
                                    pendingBus = bus
                                    awaitingPermission = true
                                    locationPerms.launchMultiplePermissionRequest()
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BusCard(
    bus: com.iiitdharwad.bustracker.data.model.Bus,
    selected: Boolean,
    onCardClick: () -> Unit,
    onStart: () -> Unit
) {
    val isActive = bus.status == "ACTIVE"
    val statusColor = if (isActive) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.outline
    }
    val statusText = if (isActive) "Active" else "Available"
    val cardAlpha = if (isActive) 0.5f else 1f

    androidx.compose.material3.Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .then(if (isActive) Modifier else Modifier.clickable(onClick = onCardClick)),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surface
        ),
        border = if (selected) androidx.compose.material3.CardDefaults.outlinedCardBorder().copy(
            width = 2.dp
        ) else null
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .padding(16.dp)
                .then(if (isActive) Modifier else Modifier)
        ) {
            Column(modifier = Modifier.alpha(cardAlpha)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                ) {
                    Text(
                        text = bus.busNumber,
                        style = MaterialTheme.typography.titleLarge,
                        color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer
                        else MaterialTheme.colorScheme.onSurface
                    )
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(statusColor.copy(alpha = 0.15f))
                            .padding(horizontal = 12.dp, vertical = 4.dp)
                    ) {
                        Text(statusText, style = MaterialTheme.typography.labelSmall, color = statusColor)
                    }
                }
                bus.routeName?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
                if (selected) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onStart,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Start Trip")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalPermissionsApi::class)
@Composable
private fun PermissionRequestCard(
    permissionsState: MultiplePermissionsState,
    onGranted: () -> Unit,
    onRationaleShown: () -> Unit
) {
    val denied = permissionsState.permissions.filter { it.status.shouldShowRationale }

    androidx.compose.runtime.LaunchedEffect(permissionsState.allPermissionsGranted) {
        if (permissionsState.allPermissionsGranted) {
            onGranted()
        } else if (denied.isNotEmpty()) {
            onRationaleShown()
        }
    }

    androidx.compose.material3.Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Icon(Icons.Default.LocationOff, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                Spacer(modifier = Modifier.padding(start = 8.dp))
                Text("Location Permission Required", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onErrorContainer)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "GPS tracking needs location access. Please grant all location permissions to continue.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onErrorContainer
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = { permissionsState.launchMultiplePermissionRequest() }) {
                Text("Grant Permissions")
            }
        }
    }
}
