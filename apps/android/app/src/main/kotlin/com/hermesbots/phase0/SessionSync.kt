package com.hermesbots.phase0

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

fun syncOpen(book: Map<String, PendingApproval>, sessionId: String, openIds: Set<String>): ApprovalResult {
    val card = book[sessionId] ?: return unchanged(book)
    if (card.resolvedLabel != null) return unchanged(book)
    if (card.id in openIds || (card.requestId.isNotEmpty() && card.requestId in openIds)) return unchanged(book)
    return ApprovalResult(without(book, sessionId), listOf(ApprovalEffect("disarm", sessionId)))
}
