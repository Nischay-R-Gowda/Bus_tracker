package com.iiitdharwad.bustracker

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.iiitdharwad.bustracker.data.local.TokenManager
import com.iiitdharwad.bustracker.data.repository.ApiRepository
import com.iiitdharwad.bustracker.data.repository.SocketManager
import com.iiitdharwad.bustracker.ui.busselection.BusSelectionScreen
import com.iiitdharwad.bustracker.ui.busselection.BusSelectionViewModel
import com.iiitdharwad.bustracker.ui.login.LoginScreen
import com.iiitdharwad.bustracker.ui.login.LoginViewModel
import com.iiitdharwad.bustracker.ui.tracking.TrackingScreen
import com.iiitdharwad.bustracker.ui.tracking.TrackingViewModel
import androidx.compose.ui.platform.LocalContext

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
                onLogout = {
                    navController.navigate("login") {
                        popUpTo("bus_selection") { inclusive = true }
                    }
                }
            )
        }
        composable("tracking") {
            TrackingScreen(
                viewModel = trackingVm,
                onTripEnded = {
                    navController.navigate("bus_selection") {
                        popUpTo("tracking") { inclusive = true }
                    }
                }
            )
        }
    }
}
