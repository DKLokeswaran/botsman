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
import org.unifiedpush.android.connector.PushService
import org.unifiedpush.android.connector.UnifiedPush
import org.unifiedpush.android.connector.data.PushEndpoint
import org.unifiedpush.android.connector.data.PushMessage

const val PUSH_PREFS = "hermes_bots_push"
const val PUSH_ENDPOINT = "endpoint"
const val PUSH_STATUS = "status"
private const val CHANNEL_ID = "hermes-bots"
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
        val channel = NotificationChannel(CHANNEL_ID, "Hermes Bots", NotificationManager.IMPORTANCE_DEFAULT)
        manager.createNotificationChannel(channel)
    }
    val intent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra("push_body", text)
    }
    val pending = PendingIntent.getActivity(
        context,
        text.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_notify)
        .setContentTitle("Hermes Bots")
        .setContentText(text)
        .setStyle(NotificationCompat.BigTextStyle().bigText(text))
        .setContentIntent(pending)
        .setAutoCancel(true)
        .build()
    manager.notify(text.hashCode(), notification)
}

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
