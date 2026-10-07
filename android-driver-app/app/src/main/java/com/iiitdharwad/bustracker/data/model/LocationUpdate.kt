package com.iiitdharwad.bustracker.data.model

data class LocationUpdate(
    val busId: Int,
    val latitude: Double,
    val longitude: Double,
    val speed: Double?,
    val heading: Double?,
    val accuracy: Double?,
    val timestamp: String
)

data class LocationPoint(
    val id: Int,
    val busId: Int,
    val latitude: Double,
    val longitude: Double,
    val speed: Double?,
    val heading: Double?,
    val accuracy: Double?,
    val timestamp: String
)

data class LocationUpdateResponse(
    val message: String,
    val location: LocationPoint
)
