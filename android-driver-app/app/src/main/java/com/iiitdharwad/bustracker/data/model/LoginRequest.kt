package com.iiitdharwad.bustracker.data.model

data class LoginRequest(
    val email: String,
    val password: String
)

data class LoginResponse(
    val token: String,
    val user: UserInfo
)

data class UserInfo(
    val id: Int,
    val email: String,
    val name: String,
    val role: String,
    val phone: String?
)
