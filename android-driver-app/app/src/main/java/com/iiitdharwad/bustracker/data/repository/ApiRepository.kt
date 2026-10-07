package com.iiitdharwad.bustracker.data.repository

import android.util.Log
import com.iiitdharwad.bustracker.data.local.TokenManager
import com.iiitdharwad.bustracker.data.model.*
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import java.io.IOException

// ---- Retrofit API definition ----
interface ApiService {
    @POST("api/auth/login")
    suspend fun login(@Body req: LoginRequest): LoginResponse

    @GET("api/buses")
    suspend fun getBuses(): BusesResponse

    @POST("api/trips/start")
    suspend fun startTrip(@Body body: StartTripRequest): TripStartResponse

    @POST("api/trips/stop")
    suspend fun endTrip(): EndTripResponse

    @GET("api/trips/my-trip")
    suspend fun getMyTrip(): MyTripResponse

    @POST("api/location/update")
    suspend fun updateLocation(@Body body: LocationUpdate): LocationUpdateResponse

    @GET("api/public/routes")
    suspend fun getRoutes(): RoutesResponse
}

data class BusesResponse(val buses: List<Bus>)
data class StartTripRequest(val busId: Int)
data class EndTripResponse(val message: String, val tripId: Int)

// ---- Repository ----
class ApiRepository(
    private val tokenManager: TokenManager,
    private var backendUrl: String
) {
    // Synchronous token cache for the OkHttp interceptor
    @Volatile private var cachedToken: String? = null

    fun updateTokenCache(token: String?) {
        cachedToken = token
    }

    fun updateBackendUrl(url: String) {
        val formatted = if (url.endsWith("/")) url else "$url/"
        if (backendUrl != formatted) {
            backendUrl = formatted
            api = createApiService(formatted)
        }
    }

    private val authInterceptor = Interceptor { chain ->
        val token = cachedToken
        val request: Request = if (token != null) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        chain.proceed(request)
    }

    private val loggingInterceptor = HttpLoggingInterceptor { msg ->
        Log.d("ApiRepository", msg)
    }.apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttp = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectionSpecs(listOf(okhttp3.ConnectionSpec.CLEARTEXT, okhttp3.ConnectionSpec.MODERN_TLS))
        .build()

    private fun createApiService(url: String): ApiService {
        return Retrofit.Builder()
            .baseUrl(if (url.endsWith("/")) url else "$url/")
            .client(okHttp)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }

    private var api: ApiService = createApiService(backendUrl)

    suspend fun login(email: String, password: String): Result<LoginResponse> = try {
        val resp = api.login(LoginRequest(email, password))
        tokenManager.saveToken(resp.token)
        cachedToken = resp.token
        Result.success(resp)
    } catch (e: HttpException) {
        Result.failure(Exception("Login failed: ${e.code()} — check credentials"))
    } catch (e: IOException) {
        Result.failure(Exception("Cannot reach server. Is it running?"))
    } catch (e: Exception) {
        Result.failure(Exception("Error: ${e.message}"))
    }

    suspend fun getBuses(): Result<List<Bus>> = try {
        val resp = api.getBuses()
        Result.success(resp.buses)
    } catch (e: HttpException) {
        if (e.code() == 401) {
            cachedToken = null
            tokenManager.clearToken()
        }
        Result.failure(Exception("Failed to load buses (${e.code()})"))
    } catch (e: Exception) {
        Result.failure(Exception("Network error: ${e.message}"))
    }

    suspend fun startTrip(busId: Int): Result<Trip> = try {
        val resp = api.startTrip(StartTripRequest(busId))
        Result.success(resp.trip)
    } catch (e: HttpException) {
        Result.failure(Exception("Failed to start trip: ${e.message()}"))
    } catch (e: Exception) {
        Result.failure(Exception("Network error: ${e.message}"))
    }

    suspend fun endTrip(): Result<Int> = try {
        val resp = api.endTrip()
        Result.success(resp.tripId)
    } catch (e: HttpException) {
        Result.failure(Exception("Failed to end trip: ${e.message()}"))
    } catch (e: Exception) {
        Result.failure(Exception("Network error: ${e.message}"))
    }

    suspend fun getMyTrip(): Result<MyTripResponse> = try {
        Result.success(api.getMyTrip())
    } catch (e: HttpException) {
        Result.failure(Exception("Failed to get trip info"))
    } catch (e: Exception) {
        Result.failure(Exception("Network error: ${e.message}"))
    }

    suspend fun sendLocation(
        busId: Int,
        lat: Double,
        lng: Double,
        speedKmh: Double?,
        heading: Double?,
        accuracy: Float?,
        timestamp: String
    ): Result<LocationPoint> = try {
        val resp = api.updateLocation(
            LocationUpdate(
                busId = busId,
                latitude = lat,
                longitude = lng,
                speed = speedKmh,
                heading = heading,
                accuracy = accuracy?.toDouble(),
                timestamp = timestamp
            )
        )
        Result.success(resp.location)
    } catch (e: HttpException) {
        if (e.code() == 401) {
            cachedToken = null
            tokenManager.clearToken()
        }
        Result.failure(Exception("Location update failed (${e.code()})"))
    } catch (e: Exception) {
        Result.failure(Exception("Network error: ${e.message}"))
    }

    suspend fun getRoutes(): Result<List<Route>> = try {
        Result.success(api.getRoutes().routes)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to load routes: ${e.message}"))
    }
}
