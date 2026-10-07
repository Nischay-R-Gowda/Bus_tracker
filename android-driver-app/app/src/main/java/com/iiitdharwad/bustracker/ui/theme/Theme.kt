package com.iiitdharwad.bustracker.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF06B6D4),
    secondary = Color(0xFF0EA5E9),
    tertiary = Color(0xFF14B8A6),
    background = Color(0xFF0A0E17),
    surface = Color(0xFF111827),
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color(0xFFE2E8F0),
    onSurface = Color(0xFFE2E8F0),
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF0891B2),
    secondary = Color(0xFF0284C7),
    tertiary = Color(0xFF0D9488),
    background = Color(0xFFF8FAFC),
    surface = Color.White,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color(0xFF1E293B),
    onSurface = Color(0xFF1E293B),
)

@Composable
fun BusTrackerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = androidx.compose.material3.Typography(),
        content = content
    )
}
