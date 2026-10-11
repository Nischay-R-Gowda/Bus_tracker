package com.iiitdharwad.bustracker.data.model

data class Trip(
    val id: Int,
    val busId: Int,
    val driverId: Int,
    val status: String,
    val startTime: String,
    val endTime: String?
)

data class BusInfo(
    val id: Int,
    val busNumber: String,
    val routeName: String?,
    val status: String
)

data class MyTripResponse(
    val trip: Trip?,
    val bus: Bus?,
    val latestLocation: LocationPoint?
)

data class TripStartResponse(
    val message: String,
    val trip: Trip
)
