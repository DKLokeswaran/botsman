package dev.botsman.alerts

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Starts the alerts connection after the phone restarts, when the owner wants it and the app has signed in.
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    val prefs = AlertsPrefs(context)
    if (prefs.enabled && prefs.token != null) AlertsService.start(context)
  }
}
