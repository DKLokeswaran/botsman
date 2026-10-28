package com.hermesbots.phase0

import org.junit.Assert.assertFalse
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
    }
}
