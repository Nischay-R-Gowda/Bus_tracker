package com.iiitdharwad.bustracker

import android.app.Application
import android.util.Log
import com.iiitdharwad.bustracker.data.local.TokenManager
import com.iiitdharwad.bustracker.data.repository.ApiRepository
import com.iiitdharwad.bustracker.data.repository.SocketManager

class BusTrackerApplication : Application() {
    lateinit var tokenManager: TokenManager
        private set

    companion object {
        @Volatile
        var apiRepository: ApiRepository? = null
            private set

        @Volatile
        var socketManager: SocketManager? = null
            private set

        fun initSingletons(repo: ApiRepository, sock: SocketManager) {
            apiRepository = repo
            socketManager = sock
        }
    }

    override fun onCreate() {
        super.onCreate()
        tokenManager = TokenManager(this)
        Log.d("BusTrackerApp", "Application initialized")
    }
}
