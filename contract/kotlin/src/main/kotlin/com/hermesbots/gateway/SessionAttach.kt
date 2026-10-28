package com.hermesbots.gateway

import okhttp3.Response

const val SESSION_UNAVAILABLE_NOTICE = "That chat is no longer available"
const val SESSION_UNAVAILABLE_CODE = 4007
const val RESUME_RETRY_MS = 30_000L
const val RECONNECT_BACKOFF_CAP_MS = 15_000L

/** JSON-RPC failure on session.resume / session.activate that means the id is gone server-side. */
fun isSessionAttachFailure(error: Throwable): Boolean {
    if (error !is HermesException) return false
    if (error.code == SESSION_UNAVAILABLE_CODE) return true
    return error.message.orEmpty().lowercase().contains("session not found")
}

fun readRetryAfterSeconds(response: Response): Int? {
    val raw = response.header("Retry-After")?.trim().orEmpty()
    if (raw.isEmpty()) return null
    return raw.toIntOrNull()?.takeIf { it > 0 }
}

/** Exponential reconnect wait with up to 25% jitter; honour HTTP Retry-After when present. */
fun reconnectDelayMs(backoffMs: Long, retryAfterSeconds: Int? = null): Long {
    val base = if (retryAfterSeconds != null && retryAfterSeconds > 0) {
        maxOf(backoffMs, retryAfterSeconds * 1000L)
    } else {
        backoffMs
    }
    val jitter = (Math.random() * base * 0.25).toLong()
    return base + jitter
}
