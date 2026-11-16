package dev.botsman.alerts

import android.content.Context
import org.json.JSONObject

// What the background connection keeps between starts: whether the owner wants it, the server and its alerts-only
// token, where the stream left off, and the names and wording its notifications use.
class AlertsPrefs(context: Context) {
  private val prefs = context.getSharedPreferences("botsman_alerts", Context.MODE_PRIVATE)

  var enabled: Boolean
    get() = prefs.getBoolean("enabled", true)
    set(value) = prefs.edit().putBoolean("enabled", value).apply()

  val server: String? get() = prefs.getString("server", null)
  val token: String? get() = prefs.getString("token", null)
  val epoch: String get() = prefs.getString("epoch", "") ?: ""
  val seq: Int get() = prefs.getInt("seq", 0)

  fun connectTo(server: String, token: String, templates: String) {
    prefs.edit().putString("server", server).putString("token", token).putString("templates", templates).apply()
  }

  fun forget() {
    prefs.edit().remove("token").remove("epoch").remove("seq").apply()
  }

  fun savePosition(epoch: String, seq: Int) {
    prefs.edit().putString("epoch", epoch).putInt("seq", seq).apply()
  }

  fun saveNames(json: String) {
    prefs.edit().putString("names", json).apply()
  }

  // The notification text for an alert, from the wording and names the app sent.
  fun alertBody(kind: String, botId: String): String {
    val name = JSONObject(prefs.getString("names", "{}") ?: "{}").optString(botId, "A bot")
    val template = JSONObject(prefs.getString("templates", "{}") ?: "{}").optString(kind, "{bot} needs you")
    return template.replace("{bot}", name)
  }
}
