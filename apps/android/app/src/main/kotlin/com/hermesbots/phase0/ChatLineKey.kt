package com.hermesbots.phase0

/**
 * Identity of a transcript row. The Windows key matches this.
 * History merge learns a row id for the same text. That must not remount the row,
 * or a user line that is expanded snaps back to Show more.
 */
@Suppress("UNUSED_PARAMETER")
fun chatLineKey(sessionId: String?, index: Int, role: String, messageId: String): String {
    return "$sessionId-$index-$role"
}
