package com.iiitdharwad.bustracker.data.model

data class RouteStop(
    val name: String,
    val latitude: Double,
    val longitude: Double
)

data class Route(
    val name: String,
    val stops: List<RouteStop>
)

data class RoutesResponse(
    val routes: List<Route>
)
