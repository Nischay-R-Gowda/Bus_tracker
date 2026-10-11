package com.iiitdharwad.bustracker

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.iiitdharwad.bustracker.data.local.TokenManager
import com.iiitdharwad.bustracker.data.repository.ApiRepository
import com.iiitdharwad.bustracker.data.repository.SocketManager
import com.iiitdharwad.bustracker.service.GpsForegroundService
import com.iiitdharwad.bustracker.ui.busselection.BusSelectionScreen
import com.iiitdharwad.bustracker.ui.busselection.BusSelectionViewModel
import com.iiitdharwad.bustracker.ui.login.LoginScreen
import com.iiitdharwad.bustracker.ui.login.LoginViewModel
import com.iiitdharwad.bustracker.ui.tracking.TrackingScreen
import com.iiitdharwad.bustracker.ui.tracking.TrackingViewModel
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch

@Composable
fun NavGraph(
    apiRepository: ApiRepository,
    socketManager: SocketManager,
    tokenManager: TokenManager
) {
    val navController = rememberNavController()
    val loginVm: LoginViewModel = viewModel { LoginViewModel(apiRepository, tokenManager, socketManager) }
    val busSelVm: BusSelectionViewModel = viewModel { BusSelectionViewModel(apiRepository) }
    val trackingVm: TrackingViewModel = viewModel { TrackingViewModel(apiRepository, socketManager) }
    val context = LocalContext.current

    /**
     * Shared logout handler:
     * - Stops GPS service if running
     * - Leaves socket room
     * - Clears auth token
     * - Resets ViewModel state
     * - Navigates to login screen (clearing back stack)
     */
    val onLogout: () -> Unit = {
        val busId = trackingVm.ui.value.busId
        GpsForegroundService.stopService(context)
        if (busId != 0) {
            socketManager.leaveBusRoom(busId)
        }
        socketManager.disconnect()
        trackingVm.resetState()

        // Clear token asynchronously
        GlobalScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            tokenManager.clearToken()
        }

        // Navigate to login, clearing the entire back stack
        navController.navigate("login") {
            popUpTo(0) { inclusive = true }
        }
    }

    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(
                viewModel = loginVm,
                onLoginSuccess = {
                    navController.navigate("bus_selection") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }
        composable("bus_selection") {
            BusSelectionScreen(
                viewModel = busSelVm,
                onNavigateToTracking = { bus ->
                    trackingVm.prepareTrip(context.applicationContext, bus)
                    navController.navigate("tracking")
                },
                onLogout = onLogout
            )
        }
        composable("tracking") {
            TrackingScreen(
                viewModel = trackingVm,
                onTripEnded = {
                    navController.navigate("bus_selection") {
                        popUpTo("tracking") { inclusive = true }
                    }
                },
                onLogout = onLogout
            )
        }
    }
}
