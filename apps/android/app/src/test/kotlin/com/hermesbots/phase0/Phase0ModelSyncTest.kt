package com.hermesbots.phase0

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The reducers Phase0Model applies for an approval card and a history refresh.
 * Windows covers the same cases in session-sync.test.ts.
 */
class Phase0ModelSyncTest {
    private fun card(sessionId: String, id: String = "srq-1") = PendingApproval(
        id = id,
        sessionId = sessionId,
        requestId = "req-1",
        description = "Read the repo",
        command = "git status",
    )

    @Test
    fun test_bug_deny_shown_as_denied_on_the_other_device() {
        val open = noteLocalChoice(emptyMap(), card("live-1"), "deny")
        assertEquals(LABEL_DENIED, open.book["live-1"]?.resolvedLabel)
        assertEquals("Allowed once", choiceLabel("once"))
        assertEquals("Allowed for session", choiceLabel("session"))
        assertEquals("Always allowed", choiceLabel("always"))

        val remote = onRequestCancel(mapOf("live-1" to card("live-1")), "srq-1", "resolved", emptySet())
        assertEquals(LABEL_ANSWERED_ELSEWHERE, remote.book["live-1"]?.resolvedLabel)
        assertEquals(true, remote.book["live-1"]?.awaitingTool)
        assertEquals("arm", remote.effects.first().type)

        val denied = onToolComplete(remote.book, "live-1", "BLOCKED: command denied by user")
        assertEquals(LABEL_DENIED_ELSEWHERE, denied.book["live-1"]?.resolvedLabel)
        assertEquals(false, denied.book["live-1"]?.awaitingTool)

        val allowed = onToolComplete(
            mapOf("live-1" to card("live-1").copy(resolvedLabel = LABEL_ANSWERED_ELSEWHERE, awaitingTool = true)),
            "live-1",
            "ok",
        )
        assertEquals(LABEL_APPROVED_ELSEWHERE, allowed.book["live-1"]?.resolvedLabel)

        val stayed = onToolComplete(
            mapOf("live-1" to card("live-1").copy(resolvedLabel = LABEL_ANSWERED_ELSEWHERE, awaitingTool = true)),
            "live-1",
            "BLOCKED: Command timed out without user response",
        )
        assertEquals(LABEL_ANSWERED_ELSEWHERE, stayed.book["live-1"]?.resolvedLabel)

        val localKept = onRequestCancel(open.book, "srq-1", "resolved", setOf("srq-1"))
        assertEquals(LABEL_DENIED, localKept.book["live-1"]?.resolvedLabel)
    }

    @Test
    fun test_bug_approval_does_not_leak_into_other_sessions() {
        val book = mapOf("live-1" to card("live-1"), "live-2" to card("live-2", "srq-2"))
        assertEquals("srq-1", visibleApproval(book, "live-1")?.id)
        assertEquals("srq-2", visibleApproval(book, "live-2")?.id)
        assertNull(visibleApproval(book, "live-3"))
        assertNull(visibleApproval(book, null))

        val resolved = onRequestCancel(book, "srq-1", "resolved", emptySet())
        assertNull(visibleApproval(resolved.book, "live-2")?.resolvedLabel)
        assertEquals(LABEL_ANSWERED_ELSEWHERE, visibleApproval(resolved.book, "live-1")?.resolvedLabel)
    }

    @Test
    fun test_bug_resolved_card_clears() {
        assertEquals(5_000L, RESOLVED_CARD_MS)
        val remote = onRequestCancel(mapOf("live-1" to card("live-1")), "req-1", "resolved", emptySet())
        val expired = expireResolved(remote.book, "live-1")
        assertNull(visibleApproval(expired.book, "live-1"))
        assertEquals("disarm", expired.effects.first().type)

        val again = onRequestCancel(mapOf("live-1" to card("live-1")), "srq-1", "resolved", emptySet())
        val cleared = onNewerMessage(again.book, "live-1")
        assertNull(visibleApproval(cleared.book, "live-1"))
        val pending = onNewerMessage(mapOf("live-1" to card("live-1")), "live-1")
        assertNull(pending.book["live-1"]?.resolvedLabel)

        val timed = onRequestCancel(mapOf("live-1" to card("live-1")), "srq-1", "timeout", emptySet())
        assertEquals(LABEL_TIMED_OUT, timed.book["live-1"]?.resolvedLabel)
        for (reason in listOf("interrupted", "shutdown", "session_closed")) {
            val gone = onRequestCancel(mapOf("live-1" to card("live-1")), "srq-1", reason, emptySet())
            assertNull(reason, visibleApproval(gone.book, "live-1"))
        }
        val cancelled = onApprovalCancelled(mapOf("live-1" to card("live-1")), listOf("req-1"))
        assertNull(visibleApproval(cancelled.book, "live-1"))
        val untouched = card("live-2", "srq-2").copy(requestId = "req-2")
        val other = onApprovalCancelled(mapOf("live-2" to untouched), listOf("req-1"))
        assertEquals("srq-2", other.book["live-2"]?.id)
    }

    @Test
    fun test_bug_history_merge_message_from_other_device() {
        val local = listOf(
            ChatLine("user", "Say hello", messageId = "1"),
            ChatLine("assistant", "Hel", messageId = "", seq = 4),
        )
        val merged = mergeHistory(
            local,
            listOf(
                HistoryEntry("user", "Say hello", "1"),
                HistoryEntry("user", "from the other phone", "2"),
            ),
        )
        assertEquals(listOf("Say hello", "from the other phone", "Hel"), merged.map { it.text })
        assertEquals(4, merged[2].seq)

        val optimistic = mergeHistory(
            listOf(ChatLine("user", "from the other phone")),
            listOf(HistoryEntry("user", "from the other phone", "8")),
        )
        assertEquals(1, optimistic.size)
        assertEquals("8", optimistic[0].messageId)

        val streamed = mergeHistory(
            listOf(ChatLine("assistant", "Hello from Hermes and more")),
            listOf(HistoryEntry("assistant", "Hello from Hermes", "9")),
        )
        assertEquals(1, streamed.size)
        assertEquals("Hello from Hermes and more", streamed[0].text)
        assertEquals("9", streamed[0].messageId)
    }
}
