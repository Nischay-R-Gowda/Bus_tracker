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
            apiRepository.getBuses()
                .onSuccess { buses ->
                    _ui.value = _ui.value.copy(buses = buses, loading = false)
                }
                .onFailure { err ->
                    _ui.value = _ui.value.copy(loading = false, error = err.message)
                }
        }
    }

    fun selectBus(bus: Bus) {
        _ui.value = _ui.value.copy(selectedBus = bus)
    }
}
