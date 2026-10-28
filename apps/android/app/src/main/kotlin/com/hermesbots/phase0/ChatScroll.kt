package com.hermesbots.phase0

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
