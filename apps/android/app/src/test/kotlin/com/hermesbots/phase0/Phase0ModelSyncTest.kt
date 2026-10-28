package com.hermesbots.phase0

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
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

        val early = onToolComplete(mapOf("live-1" to card("live-1")), "live-1", "BLOCKED: command denied by user")
        assertNull(early.book["live-1"]?.resolvedLabel)
        assertEquals(false, early.book["live-1"]?.awaitingTool)
        val afterEarly = onRequestCancel(early.book, "srq-1", "resolved", emptySet())
        assertEquals(LABEL_ANSWERED_ELSEWHERE, afterEarly.book["live-1"]?.resolvedLabel)
        val deniedAfter = onToolComplete(afterEarly.book, "live-1", "BLOCKED: command denied by user")
        assertEquals(LABEL_DENIED_ELSEWHERE, deniedAfter.book["live-1"]?.resolvedLabel)

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

        val hidden = rememberOpen(emptyMap(), card("live-2", "srq-9"), emptySet())
        assertNull(visibleApproval(hidden.book, "live-1"))
        assertEquals("srq-9", hidden.book["live-2"]?.id)

        val second = rememberOpen(
            mapOf("live-1" to card("live-1"), "live-2" to card("live-2", "srq-2")),
            card("live-1", "srq-3").copy(requestId = "req-3"),
            emptySet(),
        )
        assertEquals("srq-3", second.book["live-1"]?.id)
        assertEquals("srq-2", second.book["live-2"]?.id)
        val oldCancel = onRequestCancel(second.book, "srq-1", "resolved", emptySet())
        assertNull(oldCancel.book["live-1"]?.resolvedLabel)
        assertEquals("srq-3", oldCancel.book["live-1"]?.id)
        val newCancel = onRequestCancel(second.book, "req-3", "resolved", emptySet())
        assertEquals(LABEL_ANSWERED_ELSEWHERE, newCancel.book["live-1"]?.resolvedLabel)
        assertNull(newCancel.book["live-2"]?.resolvedLabel)
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

        val stillOpen = mapOf("live-1" to card("live-1"))
        assertNull(syncOpen(stillOpen, "live-1", setOf("srq-1")).book["live-1"]?.resolvedLabel)
        assertEquals("srq-1", syncOpen(stillOpen, "live-1", setOf("req-1")).book["live-1"]?.id)
        assertNull(visibleApproval(syncOpen(stillOpen, "live-1", emptySet()).book, "live-1"))
        val kept = mapOf("live-1" to card("live-1").copy(resolvedLabel = LABEL_ANSWERED_ELSEWHERE, awaitingTool = true))
        assertEquals(LABEL_ANSWERED_ELSEWHERE, syncOpen(kept, "live-1", emptySet()).book["live-1"]?.resolvedLabel)

        val closed = onRequestCancel(stillOpen, "srq-1", "resolved", emptySet())
        assertEquals(listOf("req-1"), idsLeavingOpen(stillOpen, closed.book))
        assertEquals(emptyList<String>(), idsLeavingOpen(closed.book, expireResolved(closed.book, "live-1").book))
        val replaced = mapOf("live-1" to card("live-1", "srq-3").copy(requestId = "req-3"))
        assertEquals(listOf("req-1"), idsLeavingOpen(stillOpen, replaced))
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

    @Test
    fun test_bug_stale_session_resume_shows_list() {
        val dropped = afterStaleSessionDropped(
            Phase0State(
                liveSessionId = "live-1",
                messages = listOf(ChatLine("user", "hello")),
                status = "Connected",
                approval = card("live-1"),
                question = PendingQuestion(
                    id = "q-1",
                    sessionId = "live-1",
                    requestId = "req-q",
                    text = "Which file?",
                ),
                focus = RouteFocusState(
                    target = "message",
                    requestId = "",
                    messageId = "1",
                    seq = 1,
                    resolved = false,
                    messageIndex = 0,
                ),
                showCommand = true,
            ),
        )
        assertNull(dropped.liveSessionId)
        assertEquals(0, dropped.messages.size)
        assertEquals("That chat is no longer available", dropped.status)
        assertNull(dropped.approval)
        assertNull(dropped.question)
        assertNull(dropped.focus)
        assertFalse(dropped.showCommand)
    }

    @Test
    fun test_bug_open_chat_survives_session_update() {
        val chat = chatAfterAttach("sess-1", "a1b2c3d4", "sess-1", "sess-1")
        assertEquals("a1b2c3d4", chat.runtimeId)
        assertEquals("sess-1", chat.resumeId)
        val again = reattachCall(chat)
        assertEquals("activate", again.method)
        assertEquals("a1b2c3d4", again.sessionId)
        assertFalse(again.method == "resume" && again.sessionId == "a1b2c3d4")
        assertFalse(shouldDropOpenChat(chat, "a1b2c3d4", "resume"))
        assertFalse(shouldDropOpenChat(chat, "a1b2c3d4", "activate"))
        assertTrue(shouldDropOpenChat(chat, "sess-1", "resume"))
        val kept = openChatAfterListUpdate(chat, listOf("sess-1", "sess-2"))
        assertEquals(chat, kept)
        assertEquals("a1b2c3d4-0-user", chatLineKey(kept.runtimeId, 0, "user", "row-9"))
        assertEquals(chatLineKey(kept.runtimeId, 0, "user", "row-9"), chatLineKey("a1b2c3d4", 0, "user", "other-row"))
    }

    @Test
    fun test_bug_notification_click_opens_approval_chat() {
        val opened = openCallForRoute("a1b2c3d4", listOf("sess-1"), null)
        assertEquals("activate", opened.method)
        assertEquals("a1b2c3d4", opened.sessionId)
        val stored = openCallForRoute("sess-1", listOf("sess-1"), null)
        assertEquals("resume", stored.method)
        assertEquals("sess-1", stored.sessionId)
        val focused = openCallForRoute("a1b2c3d4", listOf("sess-1"), OpenChat("a1b2c3d4", "sess-1"))
        assertEquals("focus", focused.method)
    }

    @Test
    fun test_bug_new_session_while_refresh_in_flight_stays_on_the_new_chat() = runBlocking {
        val epoch = OpenEpoch()
        val captured = epoch.current
        val gate = CompletableDeferred<AttachedIds>()
        var entered = false
        val pending = async {
            reattachOpenChat(
                OpenChat("live-1", "sess-1"),
                stillOpen = { epoch.same(captured) },
                activate = {
                    entered = true
                    gate.await()
                },
                resume = { error("resume not used") },
                isAttachFailure = { false },
            )
        }
        while (!entered) yield()
        val mine = epoch.begin()
        assertTrue(epoch.commit(mine))
        gate.complete(AttachedIds("live-1", "sess-1", "sess-1"))
        assertTrue(pending.await() is ReattachOutcome.Aborted)
    }

    @Test
    fun test_bug_open_another_chat_while_refresh_in_flight_stays_on_it() = runBlocking {
        val current = OpenChat("live-1", "sess-1")
        val opened = openCallForRoute("sess-2", listOf("sess-1", "sess-2"), current)
        assertEquals("resume", opened.method)
        assertEquals("sess-2", opened.sessionId)
        val epoch = OpenEpoch()
        val captured = epoch.current
        val gate = CompletableDeferred<AttachedIds>()
        var entered = false
        val pending = async {
            reattachOpenChat(
                current,
                stillOpen = { epoch.same(captured) },
                activate = {
                    entered = true
                    gate.await()
                },
                resume = { error("resume not used") },
                isAttachFailure = { false },
            )
        }
        while (!entered) yield()
        val mine = epoch.begin()
        assertTrue(epoch.commit(mine))
        gate.complete(AttachedIds("live-1", "sess-1", "sess-1"))
        assertTrue(pending.await() is ReattachOutcome.Aborted)
    }

    @Test
    fun test_bug_notification_tap_while_refresh_in_flight() = runBlocking {
        val route = openCallForRoute("live-9", listOf("sess-1"), OpenChat("live-1", "sess-1"))
        assertEquals("activate", route.method)
        assertEquals("live-9", route.sessionId)
        val epoch = OpenEpoch()
        val captured = epoch.current
        val gate = CompletableDeferred<AttachedIds>()
        var resumed = false
        val pending = async {
            reattachOpenChat(
                OpenChat("live-1", "sess-1"),
                stillOpen = { epoch.same(captured) },
                activate = { throw IllegalStateException("session not active") },
                resume = {
                    resumed = true
                    gate.await()
                },
                isAttachFailure = { error ->
                    val message = error.message.orEmpty()
                    message.contains("not active") || message.contains("not found")
                },
            )
        }
        while (!resumed) yield()
        val mine = epoch.begin()
        assertTrue(epoch.commit(mine))
        gate.complete(AttachedIds("live-2", "sess-1", "sess-1"))
        assertTrue(pending.await() is ReattachOutcome.Aborted)
    }

    @Test
    fun test_bug_reconnect_keeps_mount_and_scroll() {
        assertTrue(showOpenChat(false, true))
        assertTrue(showOpenChat(true, false))
        assertFalse(showOpenChat(false, false))
        val epoch = OpenEpoch()
        val open = epoch.current
        epoch.invalidate()
        assertFalse(epoch.same(open))
    }
}
