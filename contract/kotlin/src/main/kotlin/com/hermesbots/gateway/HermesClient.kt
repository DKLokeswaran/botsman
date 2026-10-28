package com.hermesbots.gateway

import java.io.IOException
import java.net.URLDecoder
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeout
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject

/**
 * Thin Hermes v0.22.5 gateway client.
 *
 * Written from the pinned OpenRPC contract. HTTP and the socket stay on
 * OkHttp, which is what the Android app uses instead of a WebView.
 */
class HermesException(message: String, val status: Int? = null, val code: Int? = null) : Exception(message)

private val secretQuery = Regex("((?:^|[\\s?&])(?:ticket|token|access_token|refresh_token|password)=)[^&#\\s\"']*", RegexOption.IGNORE_CASE)
private val secretJson = Regex("(\"(?:password|access_token|refresh_token|ticket|token)\"\\s*:\\s*\")[^\"]*(\")", RegexOption.IGNORE_CASE)
private val bearer = Regex("Bearer\\s+\\S+", RegexOption.IGNORE_CASE)
private val cookieValue = Regex("((?:__Host-|__Secure-)?hermes_session_[A-Za-z0-9_-]+)=[^;\\s,]*")
private val userInfo = Regex("://[^/\\s@]+:[^/\\s@]+@")

/** Drop passwords, cookies, and tokens. The surrounding label stays so the failure is still readable. */
fun scrubSecrets(text: String): String {
    return text
        .replace(userInfo, "://[redacted]@")
        .replace(bearer, "Bearer [redacted]")
        .replace(cookieValue, "$1=[redacted]")
        .replace(secretQuery, "$1[redacted]")
        .replace(secretJson, "$1[redacted]$2")
}

fun httpFailureMessage(action: String, status: Int, body: String): String {
    val detail = readDetail(body)
    return if (detail == null) "$action ($status)" else "$action ($status: $detail)"
}

fun transportFailureMessage(action: String, url: String, error: Exception): String {
    val reason = scrubSecrets(error.message ?: error.javaClass.simpleName).trim().ifEmpty { "request failed" }
    val safeUrl = scrubSecrets(url)
    return if (reason.contains(safeUrl)) "$action: $reason" else "$action: $reason URL: $safeUrl"
}

private fun readDetail(body: String): String? {
    val detail = try {
        JSONObject(body).opt("detail")
    } catch (_: Exception) {
        null
    }
    if (detail !is String) return null
    val scrubbed = scrubSecrets(detail).trim()
    return scrubbed.ifEmpty { null }
}

data class LoginMaterial(
    val username: String,
    val accessToken: String,
    val refreshToken: String,
    val provider: String,
    val expiresAt: Long?,
)

data class GatewayEvent(
    val type: String,
    val sessionId: String,
    val seq: Int?,
    val payload: JSONObject,
)

data class ServerRequest(
    val id: String,
    val method: String,
    val params: JSONObject,
)

data class ReadyInfo(
    val replayEpoch: String,
    val heartbeat: Boolean,
    val sessionAuthority: Boolean,
)

data class ProfileRow(
    val name: String,
    val displayName: String,
    val description: String,
    val model: String,
    val isDefault: Boolean,
)

data class SessionRow(
    val id: String,
    val title: String,
    val preview: String,
    val messageCount: Int,
)

data class TranscriptMessage(val role: String, val text: String)

data class ResumedSession(
    val sessionId: String,
    val messages: List<TranscriptMessage>,
    val openRequests: List<ServerRequest>,
)

data class ReplayResult(
    val events: List<GatewayEvent>,
    val latestSeq: Int,
    val truncated: Boolean,
    val epoch: String,
    val openRequests: List<ServerRequest>,
)

interface HermesListener {
    fun onEvent(event: GatewayEvent) {}
    fun onServerRequest(request: ServerRequest) {}
    fun onSocketClose() {}
}

class HermesClient(
    serverUrl: String,
    httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build(),
    var listener: HermesListener = object : HermesListener {},
) {
    // Redirects are not followed. password-login can set the session cookie on a 3xx,
    // and the next hop would not.
    private val http = httpClient.newBuilder()
        .followRedirects(false)
        .followSslRedirects(false)
        .build()
    val serverUrl: String = serverUrl.trimEnd('/')
    private val jsonMedia = "application/json".toMediaType()
    private val pending = ConcurrentHashMap<String, CompletableDeferred<Any?>>()
    private val ids = AtomicInteger()
    private val scheduler = Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "hermes-heartbeat").apply { isDaemon = true }
    }
    private var socket: WebSocket? = null
    private var heartbeat: ScheduledFuture<*>? = null
    private var lastLiveness = 0L
    private var closedOnPurpose = false
    @Volatile private var readyWait: CompletableDeferred<ReadyInfo>? = null
    private val requestWaiters = mutableListOf<(ServerRequest) -> Unit>()
    private val eventWaiters = mutableListOf<(GatewayEvent) -> Unit>()
    private val waiterLock = Any()

    suspend fun login(username: String, password: String): LoginMaterial {
        val url = "$serverUrl/auth/password-login"
        val body = JSONObject()
            .put("provider", "basic")
            .put("username", username)
            .put("password", password)
            .put("next", "/")
        val response = post(url, body, "Login failed")
        response.use {
            val access = readSetCookie(it, "hermes_session_at")
            val refresh = readSetCookie(it, "hermes_session_rt")
            val provider = readSetCookie(it, "hermes_session_provider") ?: "basic"
            if (!access.isNullOrEmpty() && !refresh.isNullOrEmpty()) {
                return LoginMaterial(username, access, refresh, provider, null)
            }
            val raw = it.body?.string().orEmpty()
            if (it.code != 200) throw HermesException(httpFailureMessage("Login failed", it.code, raw), it.code)
            throw HermesException("Login response did not include session cookies", it.code)
        }
    }

    suspend fun refresh(material: LoginMaterial): LoginMaterial {
        val url = "$serverUrl/auth/native/refresh"
        val body = JSONObject()
            .put("refresh_token", material.refreshToken)
            .put("provider", material.provider)
        val response = post(url, body, "Refresh failed")
        response.use {
            val raw = it.body?.string().orEmpty()
            if (it.code != 200) throw HermesException(httpFailureMessage("Refresh failed", it.code, raw), it.code)
            val payload = try {
                JSONObject(raw)
            } catch (_: Exception) {
                throw HermesException("Refresh response did not include tokens", it.code)
            }
            val access = payload.optString("access_token")
            val refresh = payload.optString("refresh_token")
            if (access.isEmpty() || refresh.isEmpty()) {
                throw HermesException("Refresh response did not include tokens", it.code)
            }
            return material.copy(
                accessToken = access,
                refreshToken = refresh,
                provider = payload.optString("provider", material.provider),
                expiresAt = if (payload.has("expires_at")) payload.optLong("expires_at") else null,
            )
        }
    }

    suspend fun ticket(accessToken: String): String {
        val url = "$serverUrl/api/auth/ws-ticket"
        val request = Request.Builder()
            .url(url)
            .header("authorization", "Bearer $accessToken")
            .post("".toRequestBody(null))
            .build()
        val response = try {
            http.newCall(request).execute()
        } catch (error: IOException) {
            throw HermesException(transportFailureMessage("Could not mint a websocket ticket", url, error))
        }
        response.use {
            val raw = it.body?.string().orEmpty()
            if (it.code != 200) {
                throw HermesException(httpFailureMessage("Could not mint a websocket ticket", it.code, raw), it.code)
            }
            val payload = JSONObject(raw)
            val ticket = payload.optString("ticket")
            if (ticket.isEmpty()) throw HermesException("Ticket response was empty", it.code)
            return ticket
        }
    }

    suspend fun connect(accessToken: String): ReadyInfo {
        closedOnPurpose = false
        val ticket = ticket(accessToken)
        val ready = CompletableDeferred<ReadyInfo>()
        readyWait = ready
        val request = Request.Builder().url(httpToWs(serverUrl, ticket)).build()
        socket = http.newWebSocket(request, listener())
        val info = withTimeout(15_000) { ready.await() }
        rpc("client.capabilities", JSONObject().put("server_requests", true))
        if (info.heartbeat) startHeartbeat()
        return info
    }

    suspend fun listProfiles(): List<ProfileRow> {
        val result = rpc("profiles.list", JSONObject().put("include_sessions", true))
        val rows = result.optJSONArray("profiles") ?: JSONArray()
        return (0 until rows.length()).map { index ->
            val item = rows.getJSONObject(index)
            ProfileRow(
                name = item.optString("name"),
                displayName = item.optString("display_name").ifEmpty { item.optString("name") },
                description = item.optString("description"),
                model = item.optString("model"),
                isDefault = item.optBoolean("is_default"),
            )
        }
    }

    suspend fun listSessions(): List<SessionRow> {
        val result = rpc("session.list", JSONObject())
        val rows = result.optJSONArray("sessions") ?: JSONArray()
        return (0 until rows.length()).map { index ->
            val item = rows.getJSONObject(index)
            SessionRow(
                id = item.optString("id"),
                title = item.optString("title"),
                preview = item.optString("preview"),
                messageCount = item.optInt("message_count"),
            )
        }
    }

    suspend fun createSession(): String {
        val result = rpc("session.create", JSONObject())
        return result.optString("session_id")
    }

    suspend fun resumeSession(sessionId: String): ResumedSession {
        val result = rpc(
            "session.resume",
            JSONObject()
                .put("session_id", sessionId)
                .put("omit_messages", false)
                .put("inline_images", false),
        )
        val openRequests = deliverOpenRequests(result.optJSONArray("open_requests"))
        val live = result.optString("session_id").ifEmpty { sessionId }
        return ResumedSession(live, messagesFrom(result.optJSONArray("messages")), openRequests)
    }

    suspend fun history(sessionId: String): List<TranscriptMessage> {
        val result = rpc("session.history", JSONObject().put("session_id", sessionId))
        return messagesFrom(result.optJSONArray("messages"))
    }

    suspend fun submit(sessionId: String, text: String): JSONObject {
        return rpc("prompt.submit", JSONObject().put("session_id", sessionId).put("text", text))
    }

    suspend fun replay(sessionId: String, lastSeen: Int): ReplayResult {
        val result = rpc(
            "session.events.since",
            JSONObject().put("session_id", sessionId).put("last_seen", lastSeen),
        )
        val events = jsonObjects(result.optJSONArray("events")).map { eventFromParams(it) }
        val openRequests = jsonObjects(result.optJSONArray("open_requests")).mapNotNull { requestFromOpen(it) }
        events.forEach { publishEvent(it) }
        openRequests.forEach { publishRequest(it) }
        return ReplayResult(
            events = events,
            latestSeq = result.optInt("latest_seq", lastSeen),
            truncated = result.optBoolean("truncated"),
            epoch = result.optString("epoch"),
            openRequests = openRequests,
        )
    }

    suspend fun noteApprovalVisible(sessionId: String, requestId: String) {
        rpc(
            "approval.received",
            JSONObject().put("session_id", sessionId).put("request_id", requestId),
        )
    }

    /** Settle an approval so Hermes emits request.cancel to every connected client. */
    suspend fun answerApproval(sessionId: String, requestId: String, choice: String) {
        val result = rpc(
            "approval.respond",
            JSONObject()
                .put("session_id", sessionId)
                .put("request_id", requestId)
                .put("choice", choice),
        )
        if (result.optInt("resolved") == 0) {
            throw HermesException("Approval was already resolved")
        }
    }

    fun respond(id: String, result: JSONObject) {
        socket?.send(JSONObject().put("jsonrpc", "2.0").put("id", id).put("result", result).toString())
    }

    fun decline(id: String) {
        respond(id, JSONObject().put("value", ""))
    }

    fun close() {
        closedOnPurpose = true
        heartbeat?.cancel(false)
        socket?.close(1000, "bye")
        socket = null
        readyWait?.completeExceptionally(HermesException("Socket closed before the handshake"))
        readyWait = null
        failPending(HermesException("Connection closed"))
        scheduler.shutdownNow()
    }

    suspend fun waitForServerRequest(method: String, timeoutMs: Long = 5_000): ServerRequest {
        val deferred = CompletableDeferred<ServerRequest>()
        synchronized(waiterLock) {
            requestWaiters.add { request ->
                if (request.method == method && !deferred.isCompleted) deferred.complete(request)
            }
        }
        return withTimeout(timeoutMs) { deferred.await() }
    }

    suspend fun waitForEvent(type: String, timeoutMs: Long = 5_000): GatewayEvent {
        val deferred = CompletableDeferred<GatewayEvent>()
        synchronized(waiterLock) {
            eventWaiters.add { event ->
                if (event.type == type && !deferred.isCompleted) deferred.complete(event)
            }
        }
        return withTimeout(timeoutMs) { deferred.await() }
    }

    private suspend fun rpc(method: String, params: JSONObject): JSONObject {
        val id = "c${ids.incrementAndGet()}"
        val deferred = CompletableDeferred<Any?>()
        pending[id] = deferred
        val payload = JSONObject().put("jsonrpc", "2.0").put("id", id).put("method", method).put("params", params)
        val sent = socket?.send(payload.toString()) == true
        if (!sent) {
            pending.remove(id)
            throw HermesException("$method failed to send")
        }
        val value = withTimeout(20_000) { deferred.await() }
        if (value is JSONObject) return value
        return JSONObject()
    }

    private fun listener() = object : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) {
            handleFrame(text)
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(code, null)
            handleClose()
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            handleClose()
        }
    }

    private fun handleFrame(data: String) {
        lastLiveness = System.currentTimeMillis()
        val frame = try {
            JSONObject(data)
        } catch (_: Exception) {
            return
        }
        if (frame.optString("method") == "event") {
            val params = frame.optJSONObject("params") ?: JSONObject()
            if (params.optString("type") == "gateway.ready") {
                val payload = params.optJSONObject("payload") ?: JSONObject()
                readyWait?.complete(
                    ReadyInfo(
                        replayEpoch = payload.optString("replay_epoch"),
                        heartbeat = payload.optBoolean("heartbeat"),
                        sessionAuthority = payload.optBoolean("session_authority"),
                    ),
                )
                readyWait = null
            }
            publishEvent(eventFromParams(params))
            return
        }
        if (frame.has("method") && frame.has("id")) {
            publishRequest(
                ServerRequest(
                    id = frame.get("id").toString(),
                    method = frame.getString("method"),
                    params = frame.optJSONObject("params") ?: JSONObject(),
                ),
            )
            return
        }
        if (frame.has("id") && (frame.has("result") || frame.has("error"))) {
            val waiter = pending.remove(frame.get("id").toString()) ?: return
            if (frame.has("error")) {
                val error = frame.optJSONObject("error") ?: JSONObject()
                waiter.completeExceptionally(
                    HermesException(error.optString("message", "rpc error"), code = error.optInt("code")),
                )
            } else {
                waiter.complete(frame.opt("result"))
            }
        }
    }

    private fun publishEvent(event: GatewayEvent) {
        listener.onEvent(event)
        val waiters = synchronized(waiterLock) { requestCopy(eventWaiters) }
        waiters.forEach { it(event) }
    }

    private fun publishRequest(request: ServerRequest) {
        listener.onServerRequest(request)
        val waiters = synchronized(waiterLock) { requestCopy(requestWaiters) }
        waiters.forEach { it(request) }
    }

    private fun <T> requestCopy(source: List<T>): List<T> = source.toList()

    private fun deliverOpenRequests(array: JSONArray?): List<ServerRequest> {
        val requests = jsonObjects(array).mapNotNull { requestFromOpen(it) }
        requests.forEach { publishRequest(it) }
        return requests
    }

    private fun handleClose() {
        heartbeat?.cancel(false)
        readyWait?.completeExceptionally(HermesException("Socket closed before the handshake"))
        readyWait = null
        failPending(HermesException("Socket closed"))
        if (!closedOnPurpose) listener.onSocketClose()
    }

    private fun failPending(error: Exception) {
        val waiters = pending.values.toList()
        pending.clear()
        waiters.forEach { if (!it.isCompleted) it.completeExceptionally(error) }
    }

    private fun startHeartbeat() {
        heartbeat?.cancel(false)
        lastLiveness = System.currentTimeMillis()
        var lastPing = 0L
        var sequence = 0
        heartbeat = scheduler.scheduleAtFixedRate({
            val now = System.currentTimeMillis()
            if (lastPing > lastLiveness && now - lastLiveness >= 45_000) {
                socket?.close(1001, "heartbeat")
                return@scheduleAtFixedRate
            }
            lastPing = now
            sequence += 1
            socket?.send(
                JSONObject()
                    .put("jsonrpc", "2.0")
                    .put("id", "heartbeat-$sequence")
                    .put("method", "gateway.ping")
                    .put("params", JSONObject())
                    .toString(),
            )
        }, 15, 15, TimeUnit.SECONDS)
    }

    private fun post(url: String, body: JSONObject, action: String): Response {
        val request = Request.Builder()
            .url(url)
            .post(body.toString().toRequestBody(jsonMedia))
            .build()
        try {
            return http.newCall(request).execute()
        } catch (error: IOException) {
            throw HermesException(transportFailureMessage(action, url, error))
        }
    }
}

fun readSetCookie(response: Response, name: String): String? {
    return readNamedCookie(response, name)
        ?: readNamedCookie(response, "__Host-$name")
        ?: readNamedCookie(response, "__Secure-$name")
}

private fun readNamedCookie(response: Response, name: String): String? {
    for (header in response.headers("Set-Cookie")) {
        val pair = header.substringBefore(";")
        val eq = pair.indexOf('=')
        if (eq < 0) continue
        if (pair.substring(0, eq).trim() != name) continue
        return URLDecoder.decode(pair.substring(eq + 1).trim(), Charsets.UTF_8)
    }
    return null
}

fun httpToWs(serverUrl: String, ticket: String): String {
    val base = serverUrl.trimEnd('/')
    val ws = when {
        base.startsWith("https://") -> "wss://" + base.removePrefix("https://")
        base.startsWith("http://") -> "ws://" + base.removePrefix("http://")
        else -> base
    }
    val encoded = URLEncoder.encode(ticket, Charsets.UTF_8)
    return "$ws/api/ws?ticket=$encoded"
}

private fun eventFromParams(params: JSONObject): GatewayEvent {
    return GatewayEvent(
        type = params.optString("type"),
        sessionId = params.optString("session_id"),
        seq = if (params.has("seq")) params.optInt("seq") else null,
        payload = params.optJSONObject("payload") ?: JSONObject(),
    )
}

private fun requestFromOpen(entry: JSONObject): ServerRequest? {
    if (!entry.has("id") || !entry.has("method")) return null
    return ServerRequest(
        id = entry.get("id").toString(),
        method = entry.getString("method"),
        params = entry.optJSONObject("params") ?: JSONObject(),
    )
}

private fun messagesFrom(array: JSONArray?): List<TranscriptMessage> {
    return jsonObjects(array).map { TranscriptMessage(it.optString("role"), it.optString("text")) }
}

private fun jsonObjects(array: JSONArray?): List<JSONObject> {
    if (array == null) return emptyList()
    return (0 until array.length()).map { array.getJSONObject(it) }
}
