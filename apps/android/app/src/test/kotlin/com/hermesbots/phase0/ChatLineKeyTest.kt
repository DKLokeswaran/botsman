package com.hermesbots.phase0

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ChatLineKeyTest {
    @Test
    fun test_bug_user_line_show_more_key_stable() {
        assertEquals(chatLineKey("live-1", 0, "user", ""), chatLineKey("live-1", 0, "user", "row-9"))
        assertEquals("null-0-user", chatLineKey(null, 0, "user", ""))
        assertEquals("live-1-2-assistant", chatLineKey("live-1", 2, "assistant", "row-9"))
        assertNotEquals(chatLineKey("live-1", 0, "user", ""), chatLineKey("live-2", 0, "user", ""))
        assertNotEquals(chatLineKey("live-1", 0, "user", ""), chatLineKey("live-1", 1, "user", ""))
        assertNotEquals(chatLineKey("live-1", 0, "user", ""), chatLineKey("live-1", 0, "assistant", ""))
    }
}
