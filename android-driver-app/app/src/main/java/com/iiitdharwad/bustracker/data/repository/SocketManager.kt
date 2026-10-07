package com.iiitdharwad.bustracker.data.repository

import android.util.Log
import com.iiitdharwad.bustracker.data.local.TokenManager
import com.iiitdharwad.bustracker.data.model.*
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONObject
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.cancellation.CancellationException

class SocketManager private constructor(
    private val tokenManager: TokenManager,
    private var backendUrl: String
) {
    fun updateBackendUrl(url: String) {
        if (backendUrl != url) {
            backendUrl = url
            disconnect()
            connect()
        }
    }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var socket: Socket? = null
    private var currentBusId: Int? = null

    var onLocationUpdate: ((LocationPoint) -> Unit)? = null
        private set
    var onTripStatus: ((busId: Int, status: String) -> Unit)? = null
        private set
    var onConnectionChange: ((connected: Boolean) -> Unit)? = null
        private set

    companion object {
        @Volatile private var INSTANCE: SocketManager? = null
        fun getInstance(tokenManager: TokenManager, backendUrl: String): SocketManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: SocketManager(tokenManager, backendUrl).also { INSTANCE = it }
            }
        }
    }

    fun connect() {
        if (socket?.connected() == true) return
        try {
            val uri = java.net.URI.create(backendUrl)
            val opts = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 1000
                transports = arrayOf("websocket")
                timeout = 10000
            }
            socket = IO.socket(uri, opts)
            setupListeners()
            socket?.connect()
        } catch (e: Exception) {
            Log.e("SocketManager", "Connect error", e)
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    fun setListeners(
        onLocation: (LocationPoint) -> Unit,
        onTrip: (Int, String) -> Unit,
        onConn: (Boolean) -> Unit
    ) {
        onLocationUpdate = onLocation
        onTripStatus = onTrip
        onConnectionChange = onConn
    }

    fun joinBusRoom(busId: Int) {
        currentBusId = busId
        if (socket?.connected() == true) {
            socket?.emit("driver:join-bus", busId)
        }
    }

    fun leaveBusRoom(busId: Int) {
        socket?.emit("driver:leave-bus", busId)
    }

    private fun setupListeners() {
        socket?.on("connect") { args ->
            Log.d("SocketManager", "Socket connected")
            onConnectionChange?.invoke(true)
            currentBusId?.let { socket?.emit("driver:join-bus", it) }
        }
        socket?.on("disconnect") {
            Log.d("SocketManager", "Socket disconnected")
            onConnectionChange?.invoke(false)
        }
        socket?.on("reconnect") {
            Log.d("SocketManager", "Socket reconnected")
            currentBusId?.let { socket?.emit("driver:join-bus", it) }
        }
        socket?.on("connect_error") { args ->
            Log.e("SocketManager", "Socket connect_error: ${args.joinToString()}")
        }
        socket?.on("location:update") { args ->
            try {
                val data = args[0] as? JSONObject ?: return@on
                val loc = LocationPoint(
                    id = data.optInt("id"),
                    busId = data.optInt("busId"),
                    latitude = data.optDouble("latitude"),
                    longitude = data.optDouble("longitude"),
                    speed = data.optDoubleOrNull("speed"),
                    heading = data.optDoubleOrNull("heading"),
                    accuracy = data.optDoubleOrNull("accuracy"),
                    timestamp = data.optString("timestamp")
                )
                onLocationUpdate?.invoke(loc)
            } catch (e: Exception) {
                Log.e("SocketManager", "location:update parse error", e)
            }
        }
        socket?.on("trip:status") { args ->
            try {
                val data = args[0] as? JSONObject ?: return@on
                val busId = data.optInt("busId")
                val status = data.optString("status")
                onTripStatus?.invoke(busId, status)
            } catch (e: Exception) {
                Log.e("SocketManager", "trip:status parse error", e)
            }
        }
    }
}

// Helper for nullable JSON fields
private fun JSONObject.optDoubleOrNull(name: String): Double? {
    return if (has(name) && !isNull(name)) optDouble(name) else null
}
