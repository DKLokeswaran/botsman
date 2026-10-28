package com.hermesbots.phase0

import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class LoginFormTest {
    @Test
    fun test_bug_login_stray_whitespace() {
        val credentials = credentialsForLogin("  person \n", " secret ")
        assertEquals("person", credentials.username)
        assertEquals(" secret ", credentials.password)
        assertEquals("Lo Kes", credentialsForLogin("Lo Kes", "pw").username)

        assertEquals(KeyboardCapitalization.None, UsernameKeyboard.capitalization)
        assertEquals(false, UsernameKeyboard.autoCorrectEnabled)
        assertEquals(KeyboardType.Email, UsernameKeyboard.keyboardType)
        assertEquals(KeyboardCapitalization.None, PasswordKeyboard.capitalization)
        assertEquals(false, PasswordKeyboard.autoCorrectEnabled)
        assertEquals(KeyboardType.Password, PasswordKeyboard.keyboardType)

        val invalid = "Login failed (401: Invalid credentials)"
        assertEquals("Wrong username or password", loginFailureStatus(401, invalid, "secret"))
        assertEquals(
            "Wrong username or password. Your password ends with a space",
            loginFailureStatus(401, invalid, "secret "),
        )
        assertEquals(
            "Wrong username or password. Your password starts with a space",
            loginFailureStatus(401, "Login failed (401: invalid_credentials)", " secret"),
        )
        assertEquals(
            "Wrong username or password. Your password starts and ends with a space",
            loginFailureStatus(401, "Login failed (401)", " secret\n"),
        )
        assertEquals(
            "Wrong username or password",
            loginFailureStatus(401, "Login failed (401: Unauthorized)", "sec ret"),
        )
        assertNull(passwordEdgeHint("sec ret"))
        assertEquals("Too many attempts", loginFailureStatus(429, "Login failed (429: rate_limited)", "secret "))
        assertEquals("Too many attempts", loginFailureStatus(401, "Login failed (401: Too many attempts)", "secret "))
        assertFalse(loginFailureStatus(429, "Login failed (429: rate_limited)", "secret ").contains("space"))

        val host = "Login failed (400: Invalid Host header. Dashboard requests must use the bound hostname or the configured public hostname.)"
        assertEquals(host, loginFailureStatus(400, host, "secret "))
    }
}
