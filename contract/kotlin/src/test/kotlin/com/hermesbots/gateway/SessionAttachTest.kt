package com.hermesbots.gateway

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SessionAttachTest {
    @Test
    fun isSessionAttachFailureRecognises4007() {
        assertTrue(isSessionAttachFailure(HermesException("session not found", code = SESSION_UNAVAILABLE_CODE)))
        assertTrue(isSessionAttachFailure(HermesException("Session not found on server")))
        assertEquals(false, isSessionAttachFailure(HermesException("network down")))
        assertEquals(false, isSessionAttachFailure(IllegalStateException("session not found")))
    }

    @Test
    fun reconnectDelayMsHonoursRetryAfter() {
        val withRetry = reconnectDelayMs(1000, 30)
        assertTrue(withRetry >= 30_000)
        val jittered = reconnectDelayMs(1000, null)
        assertTrue(jittered in 1000..1250)
    }
}
