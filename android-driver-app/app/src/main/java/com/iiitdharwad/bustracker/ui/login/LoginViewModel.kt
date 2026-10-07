package com.iiitdharwad.bustracker.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iiitdharwad.bustracker.data.local.TokenManager
import com.iiitdharwad.bustracker.data.repository.ApiRepository
import com.iiitdharwad.bustracker.data.repository.SocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val backendUrl: String = "http://10.0.11.159:3001",
    val loading: Boolean = false,
    val error: String? = null,
    val loginSuccess: Boolean = false
)

class LoginViewModel(
    private val apiRepository: ApiRepository,
    private val tokenManager: TokenManager,
    private val socketManager: SocketManager
) : ViewModel() {
    private val _ui = MutableStateFlow(LoginUiState())
    val ui: StateFlow<LoginUiState> = _ui.asStateFlow()

    init {
        viewModelScope.launch {
            val url = tokenManager.getBackendUrl("http://10.0.11.159:3001")
            _ui.value = _ui.value.copy(backendUrl = url)
            apiRepository.updateBackendUrl(url)
            socketManager.updateBackendUrl(url)
        }
    }

    fun onEmailChange(email: String) {
        _ui.value = _ui.value.copy(email = email, error = null)
    }

    fun onPasswordChange(password: String) {
        _ui.value = _ui.value.copy(password = password, error = null)
    }

    fun onBackendUrlChange(url: String) {
        _ui.value = _ui.value.copy(backendUrl = url, error = null)
        viewModelScope.launch {
            tokenManager.saveBackendUrl(url)
            apiRepository.updateBackendUrl(url)
            socketManager.updateBackendUrl(url)
        }
    }

    fun login() {
        val state = _ui.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _ui.value = state.copy(error = "Please enter both email and password")
            return
        }
        _ui.value = state.copy(loading = true, error = null)
        viewModelScope.launch {
            tokenManager.saveBackendUrl(state.backendUrl)
            apiRepository.updateBackendUrl(state.backendUrl)
            socketManager.updateBackendUrl(state.backendUrl)

            apiRepository.login(state.email, state.password)
                .onSuccess {
                    _ui.value = _ui.value.copy(loading = false, loginSuccess = true)
                }
                .onFailure { err ->
                    _ui.value = _ui.value.copy(loading = false, error = err.message)
                }
        }
    }
}
