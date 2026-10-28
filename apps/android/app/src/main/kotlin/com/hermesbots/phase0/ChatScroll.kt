package com.hermesbots.phase0

import kotlin.math.roundToInt

const val NEAR_BOTTOM_DP = 80

enum class ChatScrollEvent {
    USER_SEND,
    REPLY_STREAM,
    SESSION_OPEN,
}

fun shouldFollow(distanceFromBottom: Int, event: ChatScrollEvent): Boolean {
    return when (event) {
        ChatScrollEvent.USER_SEND, ChatScrollEvent.SESSION_OPEN -> true
        ChatScrollEvent.REPLY_STREAM -> distanceFromBottom <= NEAR_BOTTOM_DP
    }
}

fun shouldShowJumpToLatest(distanceFromBottom: Int): Boolean {
    return distanceFromBottom > NEAR_BOTTOM_DP
}

/** Scroll offsets are pixels. Compare them to [NEAR_BOTTOM_DP] only after this conversion. */
fun distanceDp(distancePx: Int, density: Float): Int {
    if (density <= 0f) return distancePx
    return (distancePx / density).roundToInt()
}

/** Classify a transcript change. Bulk loads use the near-bottom rule, not forced send-follow. */
fun classifyScrollEvent(
    previousCount: Int,
    previousLastText: String,
    count: Int,
    lastRole: String,
    lastText: String,
): ChatScrollEvent? {
    if (count == previousCount + 1 && lastRole == "user") return ChatScrollEvent.USER_SEND
    if (lastRole == "assistant" && (count > previousCount || lastText != previousLastText)) {
        return ChatScrollEvent.REPLY_STREAM
    }
    if (count > previousCount + 1) return ChatScrollEvent.REPLY_STREAM
    return null
}
