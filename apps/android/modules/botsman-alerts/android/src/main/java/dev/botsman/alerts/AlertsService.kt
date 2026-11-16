package dev.botsman.alerts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

// A foreground service that holds the alerts stream open and posts a notification for each alert. After a drop it
// reconnects and sends where it left off, so the server replays what it missed.
class AlertsService : Service() {
  private val client = OkHttpClient.Builder().pingInterval(25, TimeUnit.SECONDS).build()
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var prefs: AlertsPrefs
  private var socket: WebSocket? = null
  private var retryMs = FIRST_RETRY_MS
  private var running = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    prefs = AlertsPrefs(this)
    createChannels(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    showOngoing()
    if (!running) {
      running = true
      connect()
    }
    return START_STICKY
  }

  override fun onDestroy() {
    running = false
    connected = false
    handler.removeCallbacksAndMessages(null)
    socket?.close(1000, null)
    super.onDestroy()
  }

  private fun showOngoing() {
    val notification = Notification.Builder(this, CONNECTION_CHANNEL)
      .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
      .setContentTitle("Botsman")
      .setContentText("Connected for alerts")
      .setContentIntent(openApp(this, null))
      .setOngoing(true)
      .build()
    if (Build.VERSION.SDK_INT >= 34) startForeground(ONGOING_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    else startForeground(ONGOING_ID, notification)
  }

  private fun connect() {
    val server = prefs.server
    val token = prefs.token
    if (server == null || token == null) return stopSelf()
    val url = server.replaceFirst("http", "ws") + "/api/alerts"
    socket = client.newWebSocket(Request.Builder().url(url).build(), Listener(token))
  }

  private fun retry() {
    connected = false
    if (!running) return
    handler.postDelayed({ if (running) connect() }, retryMs)
    retryMs = minOf(retryMs * 2, LONGEST_RETRY_MS)
  }

  private inner class Listener(private val token: String) : WebSocketListener() {
    override fun onOpen(webSocket: WebSocket, response: Response) {
      val hello = JSONObject().put("type", "hello").put("token", token).put("epoch", prefs.epoch).put("seq", prefs.seq)
      webSocket.send(hello.toString())
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
      val message = JSONObject(text)
      when (message.optString("type")) {
        "alert" -> onAlert(message)
        "reset" -> onPosition(message)
        "error" -> onRefused(message)
      }
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
      handler.post { retry() }
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
      handler.post { retry() }
    }
  }

  private fun onPosition(message: JSONObject) {
    connected = true
    retryMs = FIRST_RETRY_MS
    prefs.savePosition(message.getString("epoch"), message.getInt("seq"))
  }

  private fun onAlert(message: JSONObject) {
    onPosition(message)
    val alert = message.getJSONObject("alert")
    if (appInFront) return
    notifyAlert(alert.getString("id"), alert.getString("kind"), alert.getString("botId"))
  }

  // The device was signed out, so its token no longer works. The connection stops until the owner signs in again.
  private fun onRefused(message: JSONObject) {
    if (message.optString("error") != "unauthorized") return
    running = false
    prefs.forget()
    stopSelf()
  }

  private fun notifyAlert(id: String, kind: String, botId: String) {
    val notification = Notification.Builder(this, ALERTS_CHANNEL)
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle("Botsman")
      .setContentText(prefs.alertBody(kind, botId))
      .setContentIntent(openApp(this, botId))
      .setAutoCancel(true)
      .build()
    getSystemService(NotificationManager::class.java).notify(id.hashCode(), notification)
  }

  companion object {
    const val ALERTS_CHANNEL = "alerts"
    const val CONNECTION_CHANNEL = "connection"
    private const val ONGOING_ID = 1
    private const val FIRST_RETRY_MS = 1_000L
    private const val LONGEST_RETRY_MS = 60_000L

    @Volatile var connected = false
    @Volatile var appInFront = false

    fun start(context: Context) {
      context.startForegroundService(Intent(context, AlertsService::class.java))
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, AlertsService::class.java))
    }

    // Alerts make a sound; the ongoing connection notice stays silent and small.
    fun createChannels(context: Context) {
      val manager = context.getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(NotificationChannel(ALERTS_CHANNEL, "Alerts", NotificationManager.IMPORTANCE_HIGH))
      manager.createNotificationChannel(NotificationChannel(CONNECTION_CHANNEL, "Background connection", NotificationManager.IMPORTANCE_MIN))
    }

    // Opens the app, on a bot's chat when one is given.
    fun openApp(context: Context, botId: String?): PendingIntent {
      val uri = if (botId == null) Uri.parse("botsman://") else Uri.parse("botsman://chat/" + Uri.encode(botId))
      val intent = Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      return PendingIntent.getActivity(context, botId?.hashCode() ?: 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
  }
}
