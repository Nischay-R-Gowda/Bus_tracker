package com.iiitdharwad.bustracker.ui.busselection

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iiitdharwad.bustracker.data.model.Bus
import com.iiitdharwad.bustracker.data.repository.ApiRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class BusSelUiState(
    val buses: List<Bus> = emptyList(),
    val selectedBus: Bus? = null,
    val loading: Boolean = false,
    val error: String? = null
)

class BusSelectionViewModel(
    private val apiRepository: ApiRepository
) : ViewModel() {
    private val _ui = MutableStateFlow(BusSelUiState())
    val ui: StateFlow<BusSelUiState> = _ui.asStateFlow()

    fun loadBuses() {
        _ui.value = _ui.value.copy(loading = true, error = null)
        viewModelScope.launch {
            // Load buses and check for existing active trip in parallel
            val busesResult = apiRepository.getBuses()
            val myTripResult = apiRepository.getMyTrip()

            val buses = busesResult.getOrNull() ?: emptyList()
            val myTrip = myTripResult.getOrNull()?.trip

            val enrichedBuses = if (myTrip != null) {
                buses.map { bus ->
                    bus.copy(hasExistingTrip = bus.id == myTrip.busId)
                }
            } else {
                buses.map { bus -> bus.copy(hasExistingTrip = false) }
            }

            _ui.value = _ui.value.copy(
                buses = enrichedBuses,
                loading = false,
                error = busesResult.exceptionOrNull()?.message
                    ?: myTripResult.exceptionOrNull()?.message
            )
        }
    }

    fun selectBus(bus: Bus) {
        _ui.value = _ui.value.copy(selectedBus = bus)
    }
}
