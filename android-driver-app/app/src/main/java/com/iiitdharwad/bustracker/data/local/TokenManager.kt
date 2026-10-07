package com.iiitdharwad.bustracker.data.local

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "bus_tracker_prefs")

class TokenManager(private val context: Context) {
    private val TOKEN_KEY = stringPreferencesKey("jwt_token")
    private val BACKEND_URL_KEY = stringPreferencesKey("backend_url")

    val tokenFlow: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[TOKEN_KEY]
    }

    suspend fun saveToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = token
        }
    }

    suspend fun getToken(): String? {
        return context.dataStore.data.map { it[TOKEN_KEY] }.firstOrNull()
    }

    suspend fun clearToken() {
        context.dataStore.edit { prefs ->
            prefs.remove(TOKEN_KEY)
        }
    }

    suspend fun saveBackendUrl(url: String) {
        context.dataStore.edit { prefs ->
            prefs[BACKEND_URL_KEY] = url
        }
    }

    suspend fun getBackendUrl(default: String = "http://10.0.11.159:3001"): String {
        return context.dataStore.data.map { it[BACKEND_URL_KEY] }.firstOrNull() ?: default
    }
}
