package com.iiitdharwad.bustracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.iiitdharwad.bustracker.data.local.TokenManager
import com.iiitdharwad.bustracker.data.repository.ApiRepository
import com.iiitdharwad.bustracker.data.repository.SocketManager
import com.iiitdharwad.bustracker.ui.theme.BusTrackerTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val app = application as BusTrackerApplication
        val tokenManager = app.tokenManager

        val apiRepository = ApiRepository(tokenManager, backendUrl = "http://10.0.11.159:3001")
        val socketManager = SocketManager.getInstance(tokenManager, backendUrl = "http://10.0.11.159:3001")

        // Initialize the app-level singletons so the ForegroundService can access them
        BusTrackerApplication.initSingletons(apiRepository, socketManager)

        // Prime the token cache
        lifecycleScope.launch {
            val token = tokenManager.getToken()
            if (token != null) {
                apiRepository.updateTokenCache(token)
            }
            socketManager.connect()
        }

        setContent {
            BusTrackerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    com.iiitdharwad.bustracker.NavGraph(
                        apiRepository = apiRepository,
                        socketManager = socketManager,
                        tokenManager = tokenManager
                    )
                }
            }
        }
    }
}
