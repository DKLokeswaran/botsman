package dev.botsman.alerts

import android.content.Context
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

// The app's handle on the background alerts connection, and on the phone settings that can stop it.
class BotsmanAlertsModule : Module() {
  private val context: Context get() = appContext.reactContext ?: throw IllegalStateException("No app context")
  private val prefs get() = AlertsPrefs(context)

  override fun definition() = ModuleDefinition {
    Name("BotsmanAlerts")

    Function("deviceSummary") { "${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}" }

    Function("isEnabled") { prefs.enabled }

    Function("setEnabled") { enabled: Boolean -> prefs.enabled = enabled }

    // Saves the server, the alerts-only token, and the wording, then starts the service.
    Function("start") { server: String, token: String, templates: Map<String, String> ->
      prefs.connectTo(server, token, JSONObject(templates).toString())
      AlertsService.start(context)
    }

    // Stops the service and drops its token, as when the owner signs out.
    Function("stop") {
      AlertsService.stop(context)
      prefs.forget()
    }

    Function("setBotNames") { names: Map<String, String> -> prefs.saveNames(JSONObject(names).toString()) }

    // While the app is in front its own screens show what needs the owner, so the service posts nothing.
    Function("setAppInFront") { inFront: Boolean -> AlertsService.appInFront = inFront }

    Function("status") {
      mapOf(
        "running" to (prefs.enabled && prefs.token != null),
        "connected" to AlertsService.connected,
        "notificationsAllowed" to context.getSystemService(NotificationManager::class.java).areNotificationsEnabled(),
        "batteryUnrestricted" to context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(context.packageName),
        "maker" to Build.MANUFACTURER.lowercase(),
      )
    }

    // Opens the system screen where the owner lets Botsman run without battery limits.
    Function("openBatterySettings") { open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }

    Function("openNotificationSettings") {
      open(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
    }
  }

  private fun open(intent: Intent) {
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
