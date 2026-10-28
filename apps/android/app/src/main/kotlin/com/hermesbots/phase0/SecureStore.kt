package com.hermesbots.phase0

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

data class SavedLogin(
    val username: String,
    val refreshToken: String,
    val provider: String,
)

/**
 * Refresh material only. The password is never written. The master key lives
 * in the Android Keystore.
 */
class SecureStore(context: Context) {
    private val prefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context,
            "hermes_bots_secrets",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun load(): SavedLogin? {
        val username = prefs.getString(KEY_USERNAME, null) ?: return null
        val refresh = prefs.getString(KEY_REFRESH, null) ?: return SavedLogin(username, "", "basic")
        val provider = prefs.getString(KEY_PROVIDER, null) ?: "basic"
        return SavedLogin(username, refresh, provider)
    }

    fun save(username: String, refreshToken: String, provider: String) {
        prefs.edit()
            .putString(KEY_USERNAME, username)
            .putString(KEY_REFRESH, refreshToken)
            .putString(KEY_PROVIDER, provider)
            .apply()
    }

    /** Drop the refresh token and keep the username for the next sign-in. */
    fun clearSecret() {
        prefs.edit().remove(KEY_REFRESH).apply()
    }

    private companion object {
        const val KEY_USERNAME = "username"
        const val KEY_REFRESH = "refresh_token"
        const val KEY_PROVIDER = "provider"
    }
}
