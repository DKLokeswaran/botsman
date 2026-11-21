// Generated from packages/protocol/schema/alerts.schema.json by `pnpm --filter @botsman/protocol alerts-schema`. Do not edit.

package dev.botsman.alerts

import org.json.JSONObject

// UNKNOWN stands for a value added after this build.
enum class AlertKind(val value: String) {
  APPROVAL("approval"),
  QUESTION("question"),
  ROUTINE_RESULT("routine_result"),
  FAILURE("failure"),
  CHANNEL_MENTION("channel_mention"),
  ROUTINE_CREATED("routine_created"),
  SKILL_CREATED("skill_created"),
  UNKNOWN("");

  companion object {
    fun from(value: String): AlertKind = entries.firstOrNull { it.value == value } ?: UNKNOWN
  }
}

data class Alert(
  val id: String,
  val kind: AlertKind,
  val botId: String,
  val refId: String,
  val createdAt: Long,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("kind", kind.value)
    .put("botId", botId)
    .put("refId", refId)
    .put("createdAt", createdAt)

  companion object {
    fun fromJson(json: JSONObject): Alert = Alert(
      json.getString("id"),
      AlertKind.from(json.getString("kind")),
      json.getString("botId"),
      json.getString("refId"),
      json.getLong("createdAt"),
    )
  }
}

sealed interface AlertsClientMessage {
  fun toJson(): JSONObject

  data class Hello(
    val token: String,
    val epoch: String,
    val seq: Long,
  ) : AlertsClientMessage {
    override fun toJson(): JSONObject = JSONObject()
      .put("type", "hello")
      .put("token", token)
      .put("epoch", epoch)
      .put("seq", seq)
  }

  data object Ping : AlertsClientMessage {
    override fun toJson(): JSONObject = JSONObject().put("type", "ping")
  }

  // A message type added after this build.
  data object Unknown : AlertsClientMessage {
    override fun toJson(): JSONObject = JSONObject()
  }

  companion object {
    fun fromJson(json: JSONObject): AlertsClientMessage = when (json.optString("type")) {
      "hello" -> AlertsClientMessage.Hello(
        json.getString("token"),
        json.getString("epoch"),
        json.getLong("seq"),
      )
      "ping" -> Ping
      else -> Unknown
    }
  }
}

sealed interface AlertsServerMessage {
  fun toJson(): JSONObject

  data class Alert(
    val epoch: String,
    val seq: Long,
    val alert: dev.botsman.alerts.Alert,
  ) : AlertsServerMessage {
    override fun toJson(): JSONObject = JSONObject()
      .put("type", "alert")
      .put("epoch", epoch)
      .put("seq", seq)
      .put("alert", alert.toJson())
  }

  data class Reset(
    val epoch: String,
    val seq: Long,
  ) : AlertsServerMessage {
    override fun toJson(): JSONObject = JSONObject()
      .put("type", "reset")
      .put("epoch", epoch)
      .put("seq", seq)
  }

  data object Ready : AlertsServerMessage {
    override fun toJson(): JSONObject = JSONObject().put("type", "ready")
  }

  data object Pong : AlertsServerMessage {
    override fun toJson(): JSONObject = JSONObject().put("type", "pong")
  }

  data class Error(
    val error: String,
    val message: String,
  ) : AlertsServerMessage {
    override fun toJson(): JSONObject = JSONObject()
      .put("type", "error")
      .put("error", error)
      .put("message", message)
  }

  // A message type added after this build.
  data object Unknown : AlertsServerMessage {
    override fun toJson(): JSONObject = JSONObject()
  }

  companion object {
    fun fromJson(json: JSONObject): AlertsServerMessage = when (json.optString("type")) {
      "alert" -> AlertsServerMessage.Alert(
        json.getString("epoch"),
        json.getLong("seq"),
        dev.botsman.alerts.Alert.fromJson(json.getJSONObject("alert")),
      )
      "reset" -> AlertsServerMessage.Reset(
        json.getString("epoch"),
        json.getLong("seq"),
      )
      "ready" -> Ready
      "pong" -> Pong
      "error" -> AlertsServerMessage.Error(
        json.getString("error"),
        json.getString("message"),
      )
      else -> Unknown
    }
  }
}
