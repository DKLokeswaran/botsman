package com.hermesbots.gateway

import org.json.JSONArray
import org.json.JSONObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PushRouteTest {
    @Test
    fun parseKeepsTheRouteFields() {
        val route = parsePush(
            """{"kind":"approval","title":"Approval waiting","body":"Read the repo","session_id":"live-1","profile":"default","request_id":"req-1","message_id":"","seq":null}""",
        )
        assertEquals("approval", route?.kind)
        assertEquals("live-1", route?.sessionId)
        assertEquals("default", route?.profile)
        assertEquals("req-1", route?.requestId)
        assertNull(route?.seq)
        assertNull(parsePush("plain text from an old notifier"))
        assertNull(parsePush("""{"kind":"other"}"""))
    }

    @Test
    fun approvalIsResolvedOnlyWhenTheRequestIsGone() {
        val route = parsePush(
            """{"kind":"approval","title":"Approval waiting","body":"Read","session_id":"live-1","profile":"","request_id":"req-1","message_id":"","seq":null}""",
        )!!
        val open = ServerRequest(
            "srq-1",
            "approval",
            JSONObject().put("request_id", "req-1").put("session_id", "live-1"),
        )
        val live = routeFocus(route, openRequestIds(listOf(open)), emptyList())
        assertEquals("approval", live.target)
        assertEquals(false, live.resolved)
        val gone = routeFocus(route, emptySet(), emptyList())
        assertEquals(true, gone.resolved)
    }

    @Test
    fun questionMatchesAQuestionId() {
        val route = parsePush(
            """{"kind":"clarify","title":"Question waiting","body":"Which one?","session_id":"live-1","profile":"","request_id":"q-1","message_id":"","seq":null}""",
        )!!
        val open = ServerRequest(
            "srq-q",
            "clarify",
            JSONObject().put("session_id", "live-1").put(
                "questions",
                JSONArray().put(JSONObject().put("qid", "q-1").put("question", "Which one?")),
            ),
        )
        assertTrue(openRequestIds(listOf(open)).contains("q-1"))
        val focus = routeFocus(route, openRequestIds(listOf(open)), emptyList())
        assertEquals("question", focus.target)
        assertEquals(false, focus.resolved)
    }

    @Test
    fun replyLandsOnTheMessageIdThenTheSeqThenTheLastLine() {
        val lines = listOf(
            TrackedMessage("1", null),
            TrackedMessage("9", 4),
        )
        val byId = routeFocus(
            parsePush("""{"kind":"reply","title":"Reply finished","body":"Hi","session_id":"live-1","profile":"","request_id":"","message_id":"9","seq":4}""")!!,
            emptySet(),
            lines,
        )
        assertEquals(1, byId.messageIndex)
        assertEquals("message", byId.target)
        val bySeq = routeFocus(
            parsePush("""{"kind":"reply","title":"Reply finished","body":"Hi","session_id":"live-1","profile":"","request_id":"","message_id":"missing","seq":4}""")!!,
            emptySet(),
            lines,
        )
        assertEquals(1, bySeq.messageIndex)
        val fallback = routeFocus(
            parsePush("""{"kind":"error","title":"Hermes error","body":"nope","session_id":"live-1","profile":"","request_id":"","message_id":"","seq":null}""")!!,
            emptySet(),
            lines,
        )
        assertEquals(1, fallback.messageIndex)
    }
}
