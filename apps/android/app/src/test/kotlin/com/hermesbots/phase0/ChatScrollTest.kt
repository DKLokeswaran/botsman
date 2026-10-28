package com.hermesbots.phase0

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatScrollTest {
    @Test
    fun test_bug_no_autoscroll_on_send() {
        assertTrue(shouldFollow(500, ChatScrollEvent.USER_SEND))
        assertTrue(shouldFollow(NEAR_BOTTOM_DP, ChatScrollEvent.REPLY_STREAM))
        assertFalse(shouldFollow(NEAR_BOTTOM_DP + 1, ChatScrollEvent.REPLY_STREAM))
        assertTrue(shouldFollow(NEAR_BOTTOM_DP + 1, ChatScrollEvent.USER_SEND))
        assertFalse(shouldShowJumpToLatest(NEAR_BOTTOM_DP))
        assertTrue(shouldShowJumpToLatest(NEAR_BOTTOM_DP + 1))
        assertTrue(shouldFollow(0, ChatScrollEvent.SESSION_OPEN))
        assertEquals(ChatScrollEvent.USER_SEND, classifyScrollEvent(2, "older", 3, "user", "sent"))
        assertEquals(ChatScrollEvent.REPLY_STREAM, classifyScrollEvent(3, "Hel", 3, "assistant", "Hello"))
        assertEquals(ChatScrollEvent.REPLY_STREAM, classifyScrollEvent(3, "Hello", 3, "assistant", "Hello."))
        assertNull(classifyScrollEvent(3, "Hello", 3, "assistant", "Hello"))
        assertEquals(ChatScrollEvent.REPLY_STREAM, classifyScrollEvent(3, "hi", 4, "assistant", "H"))
        assertNull(classifyScrollEvent(3, "Hello", 4, "error", "nope"))
        val history = classifyScrollEvent(2, "older", 30, "user", "latest")
        assertEquals(ChatScrollEvent.REPLY_STREAM, history)
        assertFalse(shouldFollow(500, history!!))
        assertTrue(shouldFollow(0, history))
        assertEquals(80, distanceDp(80, 1f))
        assertEquals(80, distanceDp(240, 3f))
        assertEquals(81, distanceDp(243, 3f))
    }
}
