package com.iiitdharwad.bustracker.ui.tracking

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iiitdharwad.bustracker.data.model.Bus
import com.iiitdharwad.bustracker.data.model.LocationPoint
import com.iiitdharwad.bustracker.data.model.Trip
import com.iiitdharwad.bustracker.data.repository.ApiRepository
import com.iiitdharwad.bustracker.data.repository.SocketManager
import com.iiitdharwad.bustracker.service.GpsForegroundService
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class TrackingViewModel(
    private val apiRepository: ApiRepository,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _ui = MutableStateFlow(TrackingUiState())
    val ui: StateFlow<TrackingUiState> = _ui.asStateFlow()

    // Called from NavGraph when navigating to tracking screen — sets up socket,
    // but does NOT start the trip or GPS. Driver must tap Start Trip.
    fun prepareTrip(context: Context, bus: Bus) {
        _ui.value = TrackingUiState(
            busId = bus.id,
            busNumber = bus.busNumber,
            tripStarted = false,
            socketConnected = false
        )

        // Connect socket and join room
        socketManager.connect()
        socketManager.setListeners(
            onLocation = { onRemoteLocation(it) },
            onTrip = { busId, status -> onRemoteTripStatus(busId, status) },
            onConn = { connected ->
                _ui.value = _ui.value.copy(socketConnected = connected)
            }
        )
        socketManager.joinBusRoom(bus.id)

        // Start polling my-trip for latest location as fallback
        startLocationPolling()
    }

    // Called when driver taps "Start Trip" button
    fun startTrip(context: Context) {
        val state = _ui.value
        if (state.tripStarted) return

        _ui.value = state.copy(startingTrip = true, error = null)

        viewModelScope.launch {
            apiRepository.startTrip(state.busId)
                .onSuccess { trip: Trip ->
                    _ui.value = _ui.value.copy(
                        tripStarted = true,
                        startingTrip = false,
                        trip = trip
                    )
                    // Start GPS foreground service only after trip is confirmed
                    GpsForegroundService.startService(context, state.busId, state.busNumber)
                }
                .onFailure { err ->
                    _ui.value = _ui.value.copy(
                        startingTrip = false,
                        error = err.message
                    )
                }
        }
    }

    // Called when driver taps "End Trip" button
    fun endTrip(context: Context) {
        val state = _ui.value

        // Stop GPS service first
        GpsForegroundService.stopService(context)

        // Leave socket room
        socketManager.leaveBusRoom(state.busId)

        viewModelScope.launch {
            apiRepository.endTrip()
                .onSuccess { tripId ->
                    _ui.value = _ui.value.copy(
                        tripEnded = true,
                        trip = null
                    )
                }
                .onFailure { err ->
                    _ui.value = _ui.value.copy(
                        error = err.message,
                        tripEnded = true,
                        trip = null
                    )
                }
        }
    }

    fun updateMovementStatus(status: String) {
        _ui.value = _ui.value.copy(movementStatus = status)
    }

    private fun onRemoteLocation(loc: LocationPoint) {
        _ui.value = _ui.value.copy(
            latestLocation = loc,
            lastUpdateTime = loc.timestamp,
            updatesSent = _ui.value.updatesSent + 1
        )
    }

    private fun onRemoteTripStatus(busId: Int, status: String) {
        if (busId == _ui.value.busId && status == "ENDED") {
            _ui.value = _ui.value.copy(tripEnded = true)
        }
    }

    private var locationPollJob: Job? = null

    private fun startLocationPolling() {
        locationPollJob?.cancel()
        locationPollJob = viewModelScope.launch {
            while (true) {
                delay(15000)
                val currentBusId = _ui.value.busId
                if (currentBusId == 0) continue

                apiRepository.getMyTrip()
                    .onSuccess { resp ->
                        resp.latestLocation?.let { loc ->
                            _ui.value = _ui.value.copy(
                                latestLocation = loc,
                                lastUpdateTime = loc.timestamp
                            )
                        }
                    }
                    .onFailure { /* silent fallback */ }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        locationPollJob?.cancel()
    }
}

data class TrackingUiState(
    val busId: Int = 0,
    val busNumber: String = "",
    val trip: Trip? = null,
    val latestLocation: LocationPoint? = null,
    val lastUpdateTime: String = "",
    val updatesSent: Int = 0,
    val movementStatus: String = "STARTING",
    val socketConnected: Boolean = false,
    val tripStarted: Boolean = false,
    val startingTrip: Boolean = false,
    val tripEnded: Boolean = false,
    val error: String? = null
)
