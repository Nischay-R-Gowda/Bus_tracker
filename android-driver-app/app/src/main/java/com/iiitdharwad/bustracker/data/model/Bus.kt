package com.iiitdharwad.bustracker.data.model

data class Bus(
    val id: Int,
    val busNumber: String,
    val routeName: String?,
    val status: String,
    val driverId: Int?
)
