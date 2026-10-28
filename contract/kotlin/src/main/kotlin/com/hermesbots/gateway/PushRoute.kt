package com.hermesbots.gateway

import org.json.JSONObject

data class PushRoute(
    val kind: String,
    val title: String,
    val body: String,
    val sessionId: String,
    val profile: String,
    val requestId: String,
    val messageId: String,
    val seq: Int?,
    val action: String? = null,
)

data class TrackedMessage(val messageId: String, val seq: Int?)

data class RouteFocus(
    val sessionId: String,
    val target: String,
    val requestId: String,
    val messageId: String,
    val seq: Int?,
    val resolved: Boolean,
    val messageIndex: Int,
)

private val pushKinds = setOf("approval", "clarify", "reply", "error")

fun parsePush(raw: String): PushRoute? {
    val trimmed = raw.trim()
    if (!trimmed.startsWith("{")) return null
    val obj = try {
        JSONObject(trimmed)
    } catch (_: Exception) {
        return null
    }
    val kind = obj.optString("kind")
    if (kind !in pushKinds) return null
    val seq = if (obj.has("seq") && !obj.isNull("seq")) obj.optInt("seq") else null
    return PushRoute(
        kind = kind,
        title = obj.optString("title"),
        body = obj.optString("body"),
        sessionId = obj.optString("session_id"),
        profile = obj.optString("profile"),
        requestId = obj.optString("request_id"),
        messageId = obj.optString("message_id"),
        seq = seq,
    )
}

fun openRequestIds(requests: List<ServerRequest>): Set<String> {
    val ids = mutableSetOf<String>()
    for (request in requests) {
        if (request.id.isNotEmpty()) ids.add(request.id)
        val requestId = request.params.optString("request_id")
        if (requestId.isNotEmpty()) ids.add(requestId)
        val questions = request.params.optJSONArray("questions") ?: continue
        for (index in 0 until questions.length()) {
            val qid = questions.optJSONObject(index)?.optString("qid").orEmpty()
            if (qid.isNotEmpty()) ids.add(qid)
        }
    }
    return ids
}

fun routeFocus(route: PushRoute, openIds: Set<String>, messages: List<TrackedMessage>): RouteFocus {
    if (route.kind == "approval" || route.kind == "clarify") {
        val resolved = route.requestId.isNotEmpty() && route.requestId !in openIds
        return RouteFocus(
            sessionId = route.sessionId,
            target = if (route.kind == "clarify") "question" else "approval",
            requestId = route.requestId,
            messageId = "",
            seq = null,
            resolved = resolved,
            messageIndex = -1,
        )
    }
    var messageIndex = -1
    if (route.messageId.isNotEmpty()) {
        messageIndex = messages.indexOfFirst { it.messageId == route.messageId }
    }
    if (messageIndex < 0 && route.seq != null) {
        messageIndex = messages.indexOfFirst { it.seq == route.seq }
    }
    if (messageIndex < 0 && messages.isNotEmpty()) {
        messageIndex = messages.lastIndex
    }
    return RouteFocus(
        sessionId = route.sessionId,
        target = if (route.sessionId.isNotEmpty() || messageIndex >= 0) "message" else "none",
        requestId = "",
        messageId = route.messageId,
        seq = route.seq,
        resolved = false,
        messageIndex = messageIndex,
    )
}
