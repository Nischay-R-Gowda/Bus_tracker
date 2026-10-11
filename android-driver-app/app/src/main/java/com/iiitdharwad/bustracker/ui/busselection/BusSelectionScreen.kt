package com.iiitdharwad.bustracker.ui.busselection

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.MultiplePermissionsState
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.google.accompanist.permissions.shouldShowRationale
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

    // Permission state — all required perms including notifications + background location
    val allPerms = rememberMultiplePermissionsState(
        permissions = PermissionHelper.allRequiredPermissions()
    )

    // Track pending bus (waiting for permission grant)
    var pendingBusId by remember { mutableStateOf<Int?>(null) }
    var showPermissionCard by remember { mutableStateOf(false) }
    var showRationaleText by remember { mutableStateOf(false) }

    // When permissions are granted and we have a pending bus, navigate
    LaunchedEffect(allPerms.allPermissionsGranted, pendingBusId) {
        if (allPerms.allPermissionsGranted && pendingBusId != null) {
            val busId = pendingBusId!!
            pendingBusId = null
            showPermissionCard = false
            showRationaleText = false
            val bus = ui.buses.find { it.id == busId }
            bus?.let { onNavigateToTracking(it) }
        }
    }

    // Check if we should show rationale when user has previously denied
    LaunchedEffect(allPerms.permissions) {
        val anyDenied = allPerms.permissions.any { it.status.shouldShowRationale }
        showRationaleText = anyDenied && !allPerms.allPermissionsGranted
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

            // Permission request card
            if (showPermissionCard) {
                PermissionRequestCard(
                    permissionsState = allPerms,
                    showRationale = showRationaleText,
                    onDismissed = {
                        showPermissionCard = false
                    }
                )
                Spacer(modifier = Modifier.height(12.dp))
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
                            hasExistingTrip = bus.hasExistingTrip,
                            selected = ui.selectedBus?.id == bus.id,
                            onCardClick = {
                                if (!bus.hasExistingTrip && bus.status != "ACTIVE") {
                                    viewModel.selectBus(bus)
                                }
                            },
                            onStart = {
                                if (allPerms.allPermissionsGranted) {
                                    onNavigateToTracking(bus)
                                } else {
                                    pendingBusId = bus.id
                                    showPermissionCard = true
                                    showRationaleText = false
                                    allPerms.launchMultiplePermissionRequest()
                                }
                            },
                            onResume = {
                                onNavigateToTracking(bus)
                            }
                        )
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
    showRationale: Boolean,
    onDismissed: () -> Unit
) {
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
                if (showRationale) {
                    "Location permission was denied. Please grant location access so the app can track the bus GPS. If you see 'Don't ask again', go to Settings > Apps > Bus Tracker > Permissions and enable Location."
                } else {
                    "GPS tracking needs location access. Please grant all location permissions to continue."
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onErrorContainer
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                if (showRationale) {
                    androidx.compose.material3.TextButton(onClick = onDismissed) {
                        Text("Cancel")
                    }
                    Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                }
                Button(onClick = { permissionsState.launchMultiplePermissionRequest() }) {
                    Text(if (showRationale) "Open Settings / Retry" else "Grant Permissions")
                }
            }
        }
    }
}

@Composable
private fun BusCard(
    bus: com.iiitdharwad.bustracker.data.model.Bus,
    hasExistingTrip: Boolean,
    selected: Boolean,
    onCardClick: () -> Unit,
    onStart: () -> Unit,
    onResume: () -> Unit
) {
    val isActive = bus.status == "ACTIVE"
    val statusColor = if (isActive) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.outline
    }
    val isCardEnabled = !isActive || hasExistingTrip
    val cardAlpha = if (isCardEnabled) 1f else 0.5f
    val statusText = if (isActive) {
        if (hasExistingTrip) "Your Active Trip" else "In Use"
    } else {
        "Available"
    }

    androidx.compose.material3.Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .then(if (isCardEnabled) Modifier.clickable(onClick = {
                if (hasExistingTrip) onResume() else onCardClick()
            }) else Modifier),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = when {
                hasExistingTrip -> MaterialTheme.colorScheme.primaryContainer
                selected -> MaterialTheme.colorScheme.primaryContainer
                else -> MaterialTheme.colorScheme.surface
            }
        ),
        border = if (selected || hasExistingTrip) androidx.compose.material3.CardDefaults.outlinedCardBorder().copy(
            width = 2.dp
        ) else null
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier.padding(16.dp)
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
                        color = if (selected || hasExistingTrip) MaterialTheme.colorScheme.onPrimaryContainer
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
                if (hasExistingTrip) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onResume,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("Resume Trip")
                    }
                } else if (selected && !isActive) {
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
