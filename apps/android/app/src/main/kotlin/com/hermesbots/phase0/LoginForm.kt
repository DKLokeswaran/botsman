package com.hermesbots.phase0

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType

data class LoginCredentials(val username: String, val password: String)

/** Trim the username only. A password may legitimately start or end with a space. */
fun credentialsForLogin(username: String, password: String): LoginCredentials {
    return LoginCredentials(username.trim(), password)
}

/** No auto-capitalisation and no suggestions. Email keyboard, same idea as a login name. */
val UsernameKeyboard = KeyboardOptions(
    capitalization = KeyboardCapitalization.None,
    autoCorrectEnabled = false,
    keyboardType = KeyboardType.Email,
)

/** Password keyboard, suggestions off. The visual transformation does not change the value. */
val PasswordKeyboard = KeyboardOptions(
    capitalization = KeyboardCapitalization.None,
    autoCorrectEnabled = false,
    keyboardType = KeyboardType.Password,
)

/**
 * Login failures name the server reason. A bare 401 is invalid credentials.
 * Rate limiting is separate, and a stray space on the password is called out.
 */
fun loginFailureStatus(status: Int?, message: String, password: String): String {
    if (isRateLimited(status, message)) return "Too many attempts"
    if (!isInvalidCredentials(status, message)) return message.ifBlank { "Login failed" }
    val hint = passwordEdgeHint(password)
    return if (hint == null) "Wrong username or password" else "Wrong username or password. $hint"
}

fun passwordEdgeHint(password: String): String? {
    if (password.isEmpty()) return null
    val leading = password.first().isWhitespace()
    val trailing = password.last().isWhitespace()
    return when {
        leading && trailing -> "Your password starts and ends with a space"
        trailing -> "Your password ends with a space"
        leading -> "Your password starts with a space"
        else -> null
    }
}

private fun isRateLimited(status: Int?, message: String): Boolean {
    val text = message.lowercase()
    return status == 429 || "rate_limited" in text || "too many" in text
}

private fun isInvalidCredentials(status: Int?, message: String): Boolean {
    if (isRateLimited(status, message)) return false
    val text = message.lowercase()
    if ("invalid_credentials" in text || "invalid credentials" in text || "unauthorized" in text) return true
    return status == 401
}
