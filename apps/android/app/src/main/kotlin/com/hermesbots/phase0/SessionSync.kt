package com.hermesbots.phase0

import kotlinx.coroutines.CancellationException

/** Per-session approval cards and transcript merge. The Windows reducer matches this. */

const val RESOLVED_CARD_MS = 5_000L

const val LABEL_ALLOWED_ONCE = "Allowed once"
const val LABEL_ALLOWED_SESSION = "Allowed for session"
const val LABEL_ALLOWED_ALWAYS = "Always allowed"
const val LABEL_DENIED = "Denied"
const val LABEL_ANSWERED_ELSEWHERE = "Answered on another device"
const val LABEL_DENIED_ELSEWHERE = "Denied on another device"
const val LABEL_APPROVED_ELSEWHERE = "Approved on another device"
const val LABEL_TIMED_OUT = "Timed out"

data class HistoryEntry(val role: String, val text: String, val rowId: String)

data class ApprovalEffect(val type: String, val sessionId: String)

data class ApprovalResult(val book: Map<String, PendingApproval>, val effects: List<ApprovalEffect>)

private val SILENT_REASONS = setOf("interrupted", "shutdown", "session_closed")

fun choiceLabel(choice: String): String = when (choice) {
    "once" -> LABEL_ALLOWED_ONCE
    "session" -> LABEL_ALLOWED_SESSION
    "always" -> LABEL_ALLOWED_ALWAYS
    "deny" -> LABEL_DENIED
    else -> "Resolved"
}

fun visibleApproval(book: Map<String, PendingApproval>, sessionId: String?): PendingApproval? {
    if (sessionId.isNullOrEmpty()) return null
    return book[sessionId]
}

fun sameTranscript(left: List<ChatLine>, right: List<ChatLine>): Boolean {
    if (left.size != right.size) return false
    return left.indices.all { index ->
        val line = left[index]
        val other = right[index]
        line.role == other.role && line.text == other.text && line.messageId == other.messageId && line.seq == other.seq
    }
}

/** A line was added or its text changed. Learning a row id for the same text does not count. */
fun transcriptGrew(prev: List<ChatLine>, next: List<ChatLine>): Boolean {
    if (next.size > prev.size) return true
    if (next.size != prev.size) return false
    return next.indices.any { index -> next[index].role != prev[index].role || next[index].text != prev[index].text }
}

fun toolResultText(result: String, resultText: String, summary: String): String {
    return listOf(result, resultText, summary).joinToString("\n")
}

/** Clear the open chat after session.resume / session.activate returns session not found. */
fun afterStaleSessionDropped(state: Phase0State, notice: String = "That chat is no longer available"): Phase0State {
    return state.copy(
        liveSessionId = null,
        messages = emptyList(),
        approval = null,
        question = null,
        focus = null,
        showCommand = false,
        status = notice,
    )
}

fun mergeHistory(local: List<ChatLine>, history: List<HistoryEntry>): List<ChatLine> {
    val used = mutableSetOf<Int>()
    val merged = mutableListOf<ChatLine>()

    fun take(predicate: (ChatLine) -> Boolean): Int {
        for (index in local.indices) {
            if (index in used) continue
            if (predicate(local[index])) return index
        }
        return -1
    }

    for (row in history) {
        val role = row.role.ifEmpty { "assistant" }
        val text = row.text
        val rowId = row.rowId
        var index = if (rowId.isNotEmpty()) take { it.messageId == rowId } else -1
        if (index < 0) {
            index = take { it.messageId.isEmpty() && it.role == role && it.text == text }
        }
        if (index < 0 && role == "assistant") {
            index = take { line ->
                if (line.messageId.isNotEmpty() || line.role != "assistant") return@take false
                text.startsWith(line.text) || line.text.startsWith(text)
            }
        }
        if (index >= 0) {
            val line = local[index]
            used.add(index)
            val keepStream = line.messageId.isEmpty() &&
                line.role == "assistant" &&
                line.text.startsWith(text) &&
                line.text.length > text.length
            merged.add(
                ChatLine(
                    role = role,
                    text = if (keepStream) line.text else text,
                    messageId = rowId.ifEmpty { line.messageId },
                    seq = line.seq,
                ),
            )
        } else {
            merged.add(ChatLine(role = role, text = text, messageId = rowId))
        }
    }

    var lastUsed = -1
    for (index in used) lastUsed = maxOf(lastUsed, index)
    for (index in (lastUsed + 1) until local.size) {
        if (index !in used) merged.add(local[index])
    }
    return merged
}

private fun unchanged(book: Map<String, PendingApproval>) = ApprovalResult(book, emptyList())

private fun located(book: Map<String, PendingApproval>, id: String): Pair<String, PendingApproval>? {
    for ((sessionId, card) in book) {
        if (card.id == id || card.requestId == id) return sessionId to card
    }
    return null
}

private fun without(book: Map<String, PendingApproval>, sessionId: String): Map<String, PendingApproval> {
    if (sessionId !in book) return book
    return book.filterKeys { it != sessionId }
}

fun noteLocalChoice(book: Map<String, PendingApproval>, card: PendingApproval, choice: String): ApprovalResult {
    val sessionId = card.sessionId
    if (sessionId.isEmpty()) return unchanged(book)
    return ApprovalResult(
        book + (sessionId to card.copy(resolvedLabel = choiceLabel(choice), awaitingTool = false)),
        listOf(ApprovalEffect("arm", sessionId)),
    )
}

fun restoreOpen(book: Map<String, PendingApproval>, card: PendingApproval): ApprovalResult {
    val sessionId = card.sessionId
    if (sessionId.isEmpty()) return unchanged(book)
    return ApprovalResult(
        book + (sessionId to card.copy(resolvedLabel = null, awaitingTool = false)),
        listOf(ApprovalEffect("disarm", sessionId)),
    )
}

fun rememberOpen(
    book: Map<String, PendingApproval>,
    card: PendingApproval,
    resolvedIds: Set<String>,
): ApprovalResult {
    if (card.sessionId.isEmpty()) return unchanged(book)
    if (card.id in resolvedIds || (card.requestId.isNotEmpty() && card.requestId in resolvedIds)) return unchanged(book)
    val existing = book[card.sessionId]
    if (existing != null && existing.id == card.id && existing.resolvedLabel == null) return unchanged(book)
    val effects = if (existing?.resolvedLabel != null) listOf(ApprovalEffect("disarm", card.sessionId)) else emptyList()
    return ApprovalResult(
        book + (card.sessionId to card.copy(resolvedLabel = null, awaitingTool = false)),
        effects,
    )
}

fun onRequestCancel(
    book: Map<String, PendingApproval>,
    id: String,
    reason: String,
    answeredIds: Set<String>,
): ApprovalResult {
    val found = located(book, id) ?: return unchanged(book)
    val (sessionId, card) = found
    if (card.id in answeredIds || (card.requestId.isNotEmpty() && card.requestId in answeredIds)) {
        return unchanged(book)
    }
    if (reason == "resolved") {
        return ApprovalResult(
            book + (sessionId to card.copy(resolvedLabel = LABEL_ANSWERED_ELSEWHERE, awaitingTool = true)),
            listOf(ApprovalEffect("arm", sessionId)),
        )
    }
    if (reason == "timeout") {
        return ApprovalResult(
            book + (sessionId to card.copy(resolvedLabel = LABEL_TIMED_OUT, awaitingTool = false)),
            listOf(ApprovalEffect("arm", sessionId)),
        )
    }
    if (reason in SILENT_REASONS || reason != "resolved") {
        return ApprovalResult(without(book, sessionId), listOf(ApprovalEffect("disarm", sessionId)))
    }
    return unchanged(book)
}

fun onApprovalCancelled(book: Map<String, PendingApproval>, requestIds: List<String>): ApprovalResult {
    var next = book
    val effects = mutableListOf<ApprovalEffect>()
    for (id in requestIds) {
        val found = located(next, id) ?: continue
        next = without(next, found.first)
        effects.add(ApprovalEffect("disarm", found.first))
    }
    return ApprovalResult(next, effects)
}

fun onToolComplete(book: Map<String, PendingApproval>, sessionId: String, resultText: String): ApprovalResult {
    val card = book[sessionId] ?: return unchanged(book)
    if (!card.awaitingTool) return unchanged(book)
    val blocked = resultText.contains("BLOCKED:", ignoreCase = true)
    val denied = blocked && resultText.contains("denied by user", ignoreCase = true)
    if (denied) {
        return ApprovalResult(
            book + (sessionId to card.copy(resolvedLabel = LABEL_DENIED_ELSEWHERE, awaitingTool = false)),
            listOf(ApprovalEffect("arm", sessionId)),
        )
    }
    if (blocked) return unchanged(book)
    return ApprovalResult(
        book + (sessionId to card.copy(resolvedLabel = LABEL_APPROVED_ELSEWHERE, awaitingTool = false)),
        listOf(ApprovalEffect("arm", sessionId)),
    )
}

fun onNewerMessage(book: Map<String, PendingApproval>, sessionId: String): ApprovalResult {
    val card = book[sessionId] ?: return unchanged(book)
    if (card.resolvedLabel == null) return unchanged(book)
    return ApprovalResult(without(book, sessionId), listOf(ApprovalEffect("disarm", sessionId)))
}

fun expireResolved(book: Map<String, PendingApproval>, sessionId: String): ApprovalResult {
    val card = book[sessionId] ?: return unchanged(book)
    if (card.resolvedLabel == null) return unchanged(book)
    return ApprovalResult(without(book, sessionId), listOf(ApprovalEffect("disarm", sessionId)))
}

/** Request ids whose open card just closed. The Android notification uses the same id. */
fun idsLeavingOpen(previous: Map<String, PendingApproval>, next: Map<String, PendingApproval>): List<String> {
    val ids = mutableListOf<String>()
    for ((sessionId, card) in previous) {
        val now = next[sessionId]
        val stillOpen = now != null && now.id == card.id && now.resolvedLabel == null
        if (!stillOpen && card.resolvedLabel == null && card.requestId.isNotEmpty()) ids.add(card.requestId)
    }
    return ids
}

data class OpenChat(val runtimeId: String, val resumeId: String)

data class AttachCall(val method: String, val sessionId: String)

/** Runtime id for events, plus the stored id that session.resume accepts. */
fun chatAfterAttach(requestedId: String, sessionId: String, storedSessionId: String, sessionKey: String): OpenChat {
    val runtimeId = sessionId.ifEmpty { requestedId }
    val stored = storedSessionId.ifBlank { sessionKey }.trim()
    var resumeId = stored
    if (resumeId.isEmpty() && requestedId.isNotEmpty() && requestedId != runtimeId) resumeId = requestedId
    if (resumeId.isEmpty()) resumeId = requestedId.ifEmpty { runtimeId }
    return OpenChat(runtimeId, resumeId)
}

/** Re-attach an open chat. A distinct runtime id uses session.activate, never session.resume. */
fun reattachCall(chat: OpenChat): AttachCall {
    if (chat.runtimeId.isNotEmpty() && chat.resumeId.isNotEmpty() && chat.runtimeId != chat.resumeId) {
        return AttachCall("activate", chat.runtimeId)
    }
    return AttachCall("resume", chat.resumeId.ifEmpty { chat.runtimeId })
}

/**
 * 4007 or 4001 for the runtime id keeps the chat while a stored resume id remains.
 * 4007 from session.resume of that stored id drops the chat.
 */
fun shouldDropOpenChat(chat: OpenChat?, failedId: String, failedMethod: String): Boolean {
    if (chat == null) return false
    if (failedId == chat.runtimeId && chat.resumeId.isNotEmpty() && chat.resumeId != chat.runtimeId) return false
    if (failedMethod == "resume" && failedId == chat.resumeId) return true
    if (failedMethod == "activate" && failedId == chat.runtimeId && (chat.resumeId.isEmpty() || chat.resumeId == chat.runtimeId)) {
        return true
    }
    return failedId == chat.resumeId
}

/** Notification and push ids are often runtime ids. Those attach with session.activate. */
fun openCallForRoute(routeSessionId: String, knownStoredIds: List<String>, current: OpenChat?): AttachCall {
    if (routeSessionId.isEmpty()) return AttachCall("focus", "")
    if (current != null && (routeSessionId == current.runtimeId || routeSessionId == current.resumeId)) {
        return AttachCall("focus", "")
    }
    if (routeSessionId in knownStoredIds) return AttachCall("resume", routeSessionId)
    return AttachCall("activate", routeSessionId)
}

/** A sessions list refresh does not retarget or clear the open chat. */
fun openChatAfterListUpdate(chat: OpenChat, sessionIds: List<String>): OpenChat {
    if (sessionIds.isEmpty()) return chat
    return chat
}

/** The session list and transcript stay mounted while the socket is down for reconnect. */
fun showOpenChat(connected: Boolean, reconnecting: Boolean): Boolean = connected || reconnecting

/**
 * Generation for the open chat. A refresh captures current at start and aborts
 * when it no longer matches. begin() runs before a user-driven attach.
 * commit() runs when that attach wins, so a refresh that sampled begin()'s
 * value still aborts.
 */
class OpenEpoch {
    var current: Int = 0
        private set

    fun begin(): Int {
        current += 1
        return current
    }

    fun commit(expected: Int): Boolean {
        if (current != expected) return false
        current = expected + 1
        return true
    }

    fun same(expected: Int): Boolean = current == expected

    fun invalidate() {
        current += 1
    }
}

data class AttachedIds(val sessionId: String, val storedSessionId: String, val sessionKey: String)

sealed class ReattachOutcome {
    data object Aborted : ReattachOutcome()
    data class Attached(val requestedId: String, val opened: AttachedIds) : ReattachOutcome()
    data class Dropped(val failedId: String, val method: String) : ReattachOutcome()
    data object Kept : ReattachOutcome()
}

/**
 * Re-attach the chat a refresh started with. After every await, abort when
 * stillOpen is false so a newer chat is not replaced. Activate 4001 and 4007
 * both fall back to session.resume of a distinct stored id.
 */
suspend fun reattachOpenChat(
    chat: OpenChat,
    stillOpen: () -> Boolean,
    activate: suspend (String) -> AttachedIds,
    resume: suspend (String) -> AttachedIds,
    isAttachFailure: (Throwable) -> Boolean,
): ReattachOutcome {
    if (!stillOpen()) return ReattachOutcome.Aborted
    val call = reattachCall(chat)
    try {
        val opened = if (call.method == "activate") activate(call.sessionId) else resume(call.sessionId)
        if (!stillOpen()) return ReattachOutcome.Aborted
        return ReattachOutcome.Attached(call.sessionId, opened)
    } catch (error: Exception) {
        if (error is CancellationException) throw error
        if (!isAttachFailure(error)) {
            if (!stillOpen()) return ReattachOutcome.Aborted
            return ReattachOutcome.Kept
        }
        val stored = chat.resumeId
        if (call.method == "activate" && stored.isNotEmpty() && stored != chat.runtimeId) {
            try {
                val opened = resume(stored)
                if (!stillOpen()) return ReattachOutcome.Aborted
                return ReattachOutcome.Attached(stored, opened)
            } catch (fallback: Exception) {
                if (fallback is CancellationException) throw fallback
                if (!stillOpen()) return ReattachOutcome.Aborted
                if (isAttachFailure(fallback)) return ReattachOutcome.Dropped(stored, "resume")
                return ReattachOutcome.Kept
            }
        }
        if (!stillOpen()) return ReattachOutcome.Aborted
        return ReattachOutcome.Dropped(call.sessionId, call.method)
    }
}

fun syncOpen(book: Map<String, PendingApproval>, sessionId: String, openIds: Set<String>): ApprovalResult {
    val card = book[sessionId] ?: return unchanged(book)
    if (card.resolvedLabel != null) return unchanged(book)
    if (card.id in openIds || (card.requestId.isNotEmpty() && card.requestId in openIds)) return unchanged(book)
    return ApprovalResult(without(book, sessionId), listOf(ApprovalEffect("disarm", sessionId)))
}
