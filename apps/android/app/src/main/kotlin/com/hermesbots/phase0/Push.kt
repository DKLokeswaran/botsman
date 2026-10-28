package com.hermesbots.phase0

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.hermesbots.gateway.parsePush
import org.unifiedpush.android.connector.PushService
import org.unifiedpush.android.connector.UnifiedPush
import org.unifiedpush.android.connector.data.PushEndpoint
import org.unifiedpush.android.connector.data.PushMessage

const val PUSH_PREFS = "hermes_bots_push"
const val PUSH_ENDPOINT = "endpoint"
const val PUSH_STATUS = "status"
private const val CHANNEL_APPROVALS = "hermes-approvals"
private const val CHANNEL_QUESTIONS = "hermes-questions"
private const val CHANNEL_REPLIES = "hermes-replies"
private const val CHANNEL_ERRORS = "hermes-errors"
private const val INSTANCE = "hermes"

class HermesPushService : PushService() {
    override fun onMessage(message: PushMessage, instance: String) {
        val text = message.content.toString(Charsets.UTF_8).ifBlank { "Hermes Bots" }
        showHermesNotification(this, text)
    }

    override fun onNewEndpoint(endpoint: PushEndpoint, instance: String) {
        prefs().edit()
            .putString(PUSH_ENDPOINT, endpoint.url)
            .putString(PUSH_STATUS, "Registered with ${endpoint.url.substringBefore("://").ifEmpty { "distributor" }}")
            .apply()
    }

    override fun onRegistrationFailed(reason: org.unifiedpush.android.connector.FailedReason, instance: String) {
        prefs().edit().putString(PUSH_STATUS, "Registration failed: $reason").apply()
    }

    override fun onUnregistered(instance: String) {
        prefs().edit().remove(PUSH_ENDPOINT).putString(PUSH_STATUS, "Unregistered").apply()
    }

    private fun prefs() = getSharedPreferences(PUSH_PREFS, MODE_PRIVATE)
}

fun showHermesNotification(context: Context, text: String) {
    val manager = context.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) {
        ensureChannels(manager)
    }
    val route = parsePush(text)
    val channel = when (route?.kind) {
        "approval" -> CHANNEL_APPROVALS
        "clarify" -> CHANNEL_QUESTIONS
        "error" -> CHANNEL_ERRORS
        else -> CHANNEL_REPLIES
    }
    val title = route?.title?.takeIf { it.isNotBlank() } ?: "Hermes Bots"
    val body = route?.body?.takeIf { it.isNotBlank() } ?: text
    val tap = PendingIntent.getActivity(
        context,
        requestCode(text, 0),
        openIntent(context, text, structured = route != null, action = null),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = NotificationCompat.Builder(context, channel)
        .setSmallIcon(R.drawable.ic_notify)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setContentIntent(tap)
        .setAutoCancel(true)
    if (route?.kind == "approval") {
        builder.addAction(0, "Allow once", actionIntent(context, text, "once"))
        builder.addAction(0, "Deny", actionIntent(context, text, "deny"))
    }
    val noticeId = if (route?.kind == "approval" && route.requestId.isNotEmpty()) {
        approvalNotificationId(route.requestId)
    } else {
        text.hashCode() and 0x7fffffff
    }
    manager.notify(noticeId, builder.build())
}

fun approvalNotificationId(requestId: String): Int = ("approval:$requestId").hashCode() and 0x7fffffff

fun dismissApprovalNotification(context: Context, requestId: String) {
    if (requestId.isEmpty()) return
    context.getSystemService(NotificationManager::class.java).cancel(approvalNotificationId(requestId))
}

private fun ensureChannels(manager: NotificationManager) {
    listOf(
        CHANNEL_APPROVALS to "Approvals",
        CHANNEL_QUESTIONS to "Questions",
        CHANNEL_REPLIES to "Replies",
        CHANNEL_ERRORS to "Errors",
    ).forEach { (id, name) ->
        manager.createNotificationChannel(NotificationChannel(id, name, NotificationManager.IMPORTANCE_DEFAULT))
    }
}

private fun openIntent(context: Context, raw: String, structured: Boolean, action: String?): Intent {
    return Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        if (structured) {
            putExtra("push_json", raw)
            if (action != null) putExtra("push_action", action)
        } else {
            putExtra("push_body", raw)
        }
    }
}

private fun actionIntent(context: Context, raw: String, action: String): PendingIntent {
    val slot = if (action == "once") 1 else 2
    return PendingIntent.getActivity(
        context,
        requestCode(raw, slot),
        openIntent(context, raw, structured = true, action = action),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}

private fun requestCode(seed: String, slot: Int): Int = (seed.hashCode() and 0x7ffffffc) + slot

fun registerUnifiedPush(activity: Activity) {
    val distributors = UnifiedPush.getDistributors(activity)
    val ntfy = distributors.firstOrNull { it.contains("ntfy", ignoreCase = true) }
    val prefs = activity.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
    if (ntfy != null) {
        UnifiedPush.saveDistributor(activity, ntfy)
        UnifiedPush.register(activity, INSTANCE, "Hermes Bots", null)
        prefs.edit().putString(PUSH_STATUS, "Registering with ntfy ($ntfy)").apply()
        return
    }
    if (distributors.isEmpty()) {
        prefs.edit().putString(PUSH_STATUS, "No distributor. Install ntfy, then tap Register.").apply()
        return
    }
    UnifiedPush.tryUseCurrentOrDefaultDistributor(activity) { success ->
        if (success) {
            UnifiedPush.register(activity, INSTANCE, "Hermes Bots", null)
            prefs.edit().putString(PUSH_STATUS, "Registering with the default distributor").apply()
        } else {
            prefs.edit().putString(PUSH_STATUS, "Pick ntfy as the UnifiedPush distributor, then tap Register.").apply()
        }
    }
}

fun notificationPermissionGranted(activity: Activity): Boolean {
    if (Build.VERSION.SDK_INT < 33) return true
    return ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) ==
        PackageManager.PERMISSION_GRANTED
}
