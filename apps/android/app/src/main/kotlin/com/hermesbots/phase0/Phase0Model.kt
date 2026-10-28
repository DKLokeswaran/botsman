package com.hermesbots.phase0

import android.app.Application
import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import android.app.Activity
import com.hermesbots.gateway.GatewayEvent
import com.hermesbots.gateway.HermesClient
import com.hermesbots.gateway.HermesException
import com.hermesbots.gateway.HermesListener
import com.hermesbots.gateway.LatestRelease
import com.hermesbots.gateway.LoginMaterial
import com.hermesbots.gateway.ProfileRow
import com.hermesbots.gateway.PushRoute
import com.hermesbots.gateway.ReleaseFile
import com.hermesbots.gateway.ServerRequest
import com.hermesbots.gateway.SessionRow
import com.hermesbots.gateway.TrackedMessage
import com.hermesbots.gateway.formatAppVersion
import com.hermesbots.gateway.openRequestIds
import com.hermesbots.gateway.parseLatest
import com.hermesbots.gateway.parsePush
import com.hermesbots.gateway.routeFocus
import com.hermesbots.gateway.updateAvailable
import java.io.File
import java.security.MessageDigest
import java.util.Collections
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

private const val DEFAULT_SERVER = "http://100.113.35.96:9119"
private const val DEFAULT_UPDATE = "http://100.113.35.96:8711"
private const val LEGACY_SERVER = "http://devbox.tail2eeb02.ts.net:9119"

data class ChatLine(val role: String, val text: String, val messageId: String = "", val seq: Int? = null)
data class PendingQuestion(
    val id: String,
    val sessionId: String,
    val requestId: String,
    val text: String,
    val resolvedLabel: String? = null,
)
data class RouteFocusState(
    val target: String,
    val requestId: String,
    val messageId: String,
    val seq: Int?,
    val resolved: Boolean,
    val messageIndex: Int,
)
data class PendingApproval(
    val id: String,
    val sessionId: String,
    val requestId: String,
    val description: String,
    val command: String,
    val resolvedLabel: String? = null,
)
data class StagedFile(val name: String, val image: ImageBitmap?)

data class Phase0State(
    val serverUrl: String = DEFAULT_SERVER,
    val updateBase: String = DEFAULT_UPDATE,
    val appVersion: String = "0.1.0 (build dev, dev)",
    val updatePhase: String = "checking",
    val updateDetail: String = "",
    val updateVersion: String = "",
    val username: String = "",
    val password: String = "",
    val status: String = "Signed out",
    val connected: Boolean = false,
    val reconnecting: Boolean = false,
    val profiles: List<ProfileRow> = emptyList(),
    val sessions: List<SessionRow> = emptyList(),
    val liveSessionId: String? = null,
    val messages: List<ChatLine> = emptyList(),
    val approval: PendingApproval? = null,
    val question: PendingQuestion? = null,
    val focus: RouteFocusState? = null,
    val showCommand: Boolean = false,
    val draft: String = "",
    val ime: String = "",
    val staged: List<StagedFile> = emptyList(),
    val pushEndpoint: String = "",
    val pushStatus: String = "UnifiedPush not registered",
    val pushBody: String = "",
)

class Phase0Model(app: Application) : AndroidViewModel(app) {
    private val secure = SecureStore(app)
    private val plain = app.getSharedPreferences("hermes_bots", Context.MODE_PRIVATE)
    private val http = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val gate = Mutex()
    private var client: HermesClient? = null
    private var material: LoginMaterial? = null
    private val seqs = mutableMapOf<String, Int>()
    private val resolvedApprovals = Collections.synchronizedSet(mutableSetOf<String>())
    private val answeredHere = Collections.synchronizedSet(mutableSetOf<String>())
    private var pendingRoute: PushRoute? = null
    private var pendingRelease: LatestRelease? = null
    private var reconnectJob: Job? = null
    private var intentionalClose = false

    private val _state = MutableStateFlow(Phase0State())
    val state: StateFlow<Phase0State> = _state

    private val listener = object : HermesListener {
        override fun onEvent(event: GatewayEvent) {
            val seq = event.seq
            if (seq != null && event.sessionId.isNotEmpty()) {
                seqs[event.sessionId] = maxOf(seqs[event.sessionId] ?: 0, seq)
            }
            if (event.type == "request.cancel") {
                forgetApproval(event.payload.optString("id"), event.payload.optString("reason"))
                return
            }
            if (event.type == "approval.cancelled") {
                val ids = event.payload.optJSONArray("request_ids")
                if (ids != null) {
                    for (index in 0 until ids.length()) {
                        forgetApproval(ids.optString(index), null)
                    }
                }
                return
            }
            val live = _state.value.liveSessionId
            if (event.sessionId.isNotEmpty() && live != null && event.sessionId != live) return
            when (event.type) {
                "message.delta" -> {
                    val chunk = event.payload.optString("text")
                    if (chunk.isEmpty() || chunk == "null") return
                    _state.update { current ->
                        val lines = current.messages.toMutableList()
                        val last = lines.lastOrNull()
                        if (last != null && last.role == "assistant") {
                            lines[lines.lastIndex] = last.copy(text = last.text + chunk)
                        } else {
                            lines.add(ChatLine("assistant", chunk))
                        }
                        current.copy(messages = lines)
                    }
                }
                "message.complete" -> {
                    val text = event.payload.optString("text")
                    val failed = event.payload.optString("status") == "error"
                    val messageId = messageIdFrom(event.payload)
                    _state.update { current ->
                        val lines = current.messages.toMutableList()
                        val body = text.ifEmpty { event.payload.optString("error", "Reply finished") }
                        val role = if (failed) "error" else "assistant"
                        val previous = lines.lastOrNull()
                        if (previous?.role == "assistant") {
                            lines[lines.lastIndex] = previous.copy(
                                role = role,
                                text = body,
                                messageId = messageId.ifEmpty { previous.messageId },
                                seq = event.seq,
                            )
                        } else {
                            lines.add(ChatLine(role, body, messageId = messageId, seq = event.seq))
                        }
                        current.copy(messages = lines, status = if (failed) "Reply failed" else "Connected")
                    }
                }
                "error" -> {
                    val text = event.payload.optString("message", event.payload.optString("text", "Error"))
                    _state.update { it.copy(messages = it.messages + ChatLine("error", text, seq = event.seq), status = "Error") }
                }
            }
        }

        override fun onServerRequest(request: ServerRequest) {
            if (request.method == "approval") {
                if (resolvedApprovals.contains(request.id) || answeredHere.contains(request.id)) return
                val card = PendingApproval(
                    id = request.id,
                    sessionId = request.params.optString("session_id"),
                    requestId = request.params.optString("request_id"),
                    description = request.params.optString("description").ifEmpty { "Approval needed" },
                    command = request.params.optString("command"),
                )
                _state.update { current ->
                    if (current.approval?.id == card.id) current else current.copy(approval = card, showCommand = false)
                }
                viewModelScope.launch {
                    try {
                        client?.noteApprovalVisible(card.sessionId, card.requestId)
                    } catch (_: Exception) {
                        // The card is already on screen. A missed ack only delays the server timer.
                    }
                }
            } else if (request.method == "clarify" && holdsQuestion(request)) {
                val first = request.params.optJSONArray("questions")?.optJSONObject(0)
                val text = first?.optString("question").orEmpty().ifEmpty { "Question" }
                val qid = first?.optString("qid").orEmpty().ifEmpty { request.id }
                _state.update {
                    it.copy(
                        question = PendingQuestion(
                            id = request.id,
                            sessionId = request.params.optString("session_id"),
                            requestId = qid,
                            text = text,
                        ),
                    )
                }
            } else {
                client?.decline(request.id)
            }
        }

        override fun onSocketClose() {
            if (!intentionalClose) scheduleReconnect()
        }
    }

    init {
        val saved = secure.load()
        val endpoint = app.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
        val storedUrl = plain.getString("server_url", null)?.trim()?.trimEnd('/')
        val serverUrl = if (storedUrl.isNullOrEmpty() || storedUrl.equals(LEGACY_SERVER, ignoreCase = true)) {
            DEFAULT_SERVER
        } else {
            storedUrl
        }
        if (serverUrl != storedUrl) {
            plain.edit().putString("server_url", serverUrl).apply()
        }
        val storedUpdate = plain.getString("update_base", null)?.trim()?.trimEnd('/')
        val updateBase = if (storedUpdate.isNullOrEmpty()) DEFAULT_UPDATE else storedUpdate
        _state.update {
            it.copy(
                serverUrl = serverUrl,
                updateBase = updateBase,
                appVersion = formatAppVersion(BuildConfig.HERMES_VERSION_NAME, BuildConfig.HERMES_BUILD, BuildConfig.HERMES_SHA),
                username = saved?.username ?: "",
                pushEndpoint = endpoint.getString(PUSH_ENDPOINT, "") ?: "",
                pushStatus = endpoint.getString(PUSH_STATUS, it.pushStatus) ?: it.pushStatus,
            )
        }
        endpoint.registerOnSharedPreferenceChangeListener { _, _ ->
            _state.update {
                it.copy(
                    pushEndpoint = endpoint.getString(PUSH_ENDPOINT, "") ?: "",
                    pushStatus = endpoint.getString(PUSH_STATUS, "") ?: "",
                )
            }
        }
        if (!saved?.refreshToken.isNullOrEmpty()) {
            viewModelScope.launch { restore(saved) }
        }
        checkForUpdate()
    }

    fun update(
        serverUrl: String? = null,
        username: String? = null,
        password: String? = null,
        draft: String? = null,
        ime: String? = null,
        updateBase: String? = null,
    ) {
        if (updateBase != null) {
            plain.edit().putString("update_base", updateBase.trim()).apply()
        }
        _state.update {
            it.copy(
                serverUrl = serverUrl ?: it.serverUrl,
                username = username ?: it.username,
                password = password ?: it.password,
                draft = draft ?: it.draft,
                ime = ime ?: it.ime,
                updateBase = updateBase ?: it.updateBase,
            )
        }
    }

    fun login() {
        val snapshot = _state.value
        viewModelScope.launch {
            _state.update { it.copy(status = "Signing in", password = "") }
            plain.edit().putString("server_url", snapshot.serverUrl).apply()
            try {
                val fresh = withContext(Dispatchers.IO) {
                    val signing = HermesClient(snapshot.serverUrl, http)
                    try {
                        signing.login(snapshot.username, snapshot.password)
                    } finally {
                        signing.close()
                    }
                }
                establish(fresh)
            } catch (error: Exception) {
                _state.update { it.copy(status = error.message ?: "Login failed", connected = false) }
            }
        }
    }

    fun openSession(sessionId: String, profile: String = "") {
        viewModelScope.launch {
            val current = client ?: return@launch
            _state.update { it.copy(question = null) }
            try {
                val opened = withContext(Dispatchers.IO) { current.resumeSession(sessionId, profile.ifBlank { null }) }
                val history = withContext(Dispatchers.IO) { current.history(opened.sessionId) }
                val lines = history.map { row -> ChatLine(row.role.ifEmpty { "assistant" }, row.text, messageId = row.rowId) }
                _state.update {
                    it.copy(
                        liveSessionId = opened.sessionId,
                        messages = lines,
                        status = "Connected",
                    )
                }
                syncOpenApprovals(opened.openRequests)
                val route = pendingRoute
                if (route != null && (route.sessionId.isEmpty() || route.sessionId == opened.sessionId)) {
                    pendingRoute = null
                    placeFocus(route, opened.openRequests, lines)
                }
            } catch (error: Exception) {
                _state.update { it.copy(status = error.message ?: "Could not open the session") }
            }
        }
    }

    fun newSession() {
        viewModelScope.launch {
            val current = client ?: return@launch
            try {
                val id = withContext(Dispatchers.IO) { current.createSession() }
                _state.update { it.copy(liveSessionId = id, messages = emptyList(), question = null, focus = null, status = "New session") }
                refreshLists()
            } catch (error: Exception) {
                _state.update { it.copy(status = error.message ?: "Could not create a session") }
            }
        }
    }

    fun send() {
        val snapshot = _state.value
        val session = snapshot.liveSessionId ?: return
        val text = snapshot.draft.trim()
        if (text.isEmpty()) return
        val current = client ?: return
        _state.update { it.copy(draft = "", messages = it.messages + ChatLine("user", text), status = "Sending") }
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { current.submit(session, text) }
            } catch (error: Exception) {
                _state.update { it.copy(status = error.message ?: "Send failed") }
            }
        }
    }

    fun answer(choice: String) {
        val card = _state.value.approval ?: return
        if (card.resolvedLabel != null) return
        val current = client ?: return
        answeredHere.add(card.id)
        resolvedApprovals.add(card.id)
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { current.answerApproval(card.sessionId, card.requestId, choice) }
                _state.update {
                    it.copy(
                        approval = if (it.approval?.id == card.id) null else it.approval,
                        showCommand = false,
                        status = if (choice == "deny") "Denied" else "Allowed once",
                    )
                }
            } catch (error: Exception) {
                answeredHere.remove(card.id)
                resolvedApprovals.remove(card.id)
                _state.update { it.copy(status = error.message ?: "Approval failed") }
            }
        }
    }

    fun toggleCommand() {
        _state.update { it.copy(showCommand = !it.showCommand) }
    }

    fun stage(name: String, bytes: ByteArray, image: Boolean) {
        val bitmap = if (image) BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() else null
        _state.update { it.copy(staged = it.staged + StagedFile(name, bitmap)) }
    }

    fun pasteClipboard(context: Context) {
        val clipboard = context.getSystemService(android.content.ClipboardManager::class.java) ?: return
        val clip = clipboard.primaryClip ?: return
        if (clip.itemCount == 0) return
        val item = clip.getItemAt(0)
        val uri = item.uri
        if (uri != null) {
            readUri(context, uri, "pasted-image", imageOnly = true)
            return
        }
    }

    fun readUri(context: Context, uri: Uri, fallbackName: String, imageOnly: Boolean = false) {
        viewModelScope.launch(Dispatchers.IO) {
            val type = context.contentResolver.getType(uri).orEmpty()
            val image = type.startsWith("image/")
            if (imageOnly && !image) return@launch
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@launch
            val name = fallbackName
            stage(name, bytes, image)
        }
    }

    fun notePush(raw: String, action: String? = null) {
        val route = parsePush(raw)
        if (route == null) {
            _state.update { it.copy(pushBody = raw) }
            return
        }
        val chosen = if (action == "once" || action == "deny") route.copy(action = action) else route
        pendingRoute = chosen
        _state.update { it.copy(pushBody = chosen.body.ifBlank { chosen.title }) }
        if (_state.value.connected) followRoute()
    }

    private suspend fun restore(saved: SavedLogin) {
        val url = _state.value.serverUrl
        try {
            val refreshed = withContext(Dispatchers.IO) {
                val signing = HermesClient(url, http)
                try {
                    signing.refresh(
                        LoginMaterial(saved.username, "", saved.refreshToken, saved.provider, null),
                    )
                } finally {
                    signing.close()
                }
            }
            establish(refreshed)
        } catch (error: Exception) {
            val message = error.message ?: "Refresh failed"
            if (error is HermesException && error.status == 401) secure.clearSecret()
            val rejected = error is HermesException && error.status == 401
            _state.update {
                it.copy(
                    username = saved.username,
                    connected = false,
                    reconnecting = if (rejected) false else it.reconnecting,
                    status = if (rejected) "Sign in again. $message" else message,
                )
            }
        }
    }

    private suspend fun establish(nextMaterial: LoginMaterial) {
        gate.withLock {
            intentionalClose = true
            client?.close()
            intentionalClose = false
            val url = _state.value.serverUrl
            val next = HermesClient(url, http, listener)
            val ready = withContext(Dispatchers.IO) { next.connect(nextMaterial.accessToken) }
            client = next
            material = nextMaterial
            secure.save(nextMaterial.username, nextMaterial.refreshToken, nextMaterial.provider)
            _state.update {
                it.copy(
                    connected = true,
                    reconnecting = false,
                    username = nextMaterial.username,
                    password = "",
                    status = if (ready.sessionAuthority) "Connected (session authority)" else "Connected",
                )
            }
            refreshLists()
            val live = _state.value.liveSessionId
            val route = pendingRoute
            if (route != null && route.sessionId.isNotEmpty() && route.sessionId != live) {
                openSession(route.sessionId, route.profile)
            } else if (live != null) {
                val replay = withContext(Dispatchers.IO) { next.replay(live, seqs[live] ?: 0) }
                syncOpenApprovals(replay.openRequests)
                if (replay.truncated) {
                    openSession(live)
                } else if (route != null && (route.sessionId.isEmpty() || route.sessionId == live)) {
                    pendingRoute = null
                    placeFocus(route, replay.openRequests, _state.value.messages)
                }
            } else if (route != null) {
                followRoute()
            }
        }
    }

    private suspend fun refreshLists() {
        val current = client ?: return
        val profiles = withContext(Dispatchers.IO) { current.listProfiles() }
        val sessions = withContext(Dispatchers.IO) { current.listSessions() }
        _state.update { it.copy(profiles = profiles, sessions = sessions) }
    }

    private fun holdsQuestion(request: ServerRequest): Boolean {
        val route = pendingRoute ?: return false
        if (route.kind != "clarify") return false
        val session = request.params.optString("session_id")
        if (route.sessionId.isNotEmpty() && session.isNotEmpty() && route.sessionId != session) return false
        if (route.requestId.isEmpty() || route.requestId == request.id) return true
        val questions = request.params.optJSONArray("questions") ?: return false
        for (index in 0 until questions.length()) {
            if (questions.optJSONObject(index)?.optString("qid") == route.requestId) return true
        }
        return false
    }

    private fun followRoute() {
        val route = pendingRoute ?: return
        if (!_state.value.connected) return
        if (route.sessionId.isNotEmpty() && _state.value.liveSessionId != route.sessionId) {
            openSession(route.sessionId, route.profile)
            return
        }
        val lines = _state.value.messages
        pendingRoute = null
        placeFocus(route, liveOpenRequests(), lines)
    }

    private fun liveOpenRequests(): List<ServerRequest> {
        val requests = mutableListOf<ServerRequest>()
        val card = _state.value.approval
        if (card != null && card.resolvedLabel == null) {
            requests.add(ServerRequest(card.id, "approval", JSONObject().put("request_id", card.requestId)))
        }
        val question = _state.value.question
        if (question != null && question.resolvedLabel == null) {
            requests.add(
                ServerRequest(
                    question.id,
                    "clarify",
                    JSONObject().put("questions", JSONArray().put(JSONObject().put("qid", question.requestId))),
                ),
            )
        }
        return requests
    }

    private fun placeFocus(route: PushRoute, open: List<ServerRequest>, lines: List<ChatLine>) {
        val focus = routeFocus(route, openRequestIds(open), lines.map { TrackedMessage(it.messageId, it.seq) })
        _state.update { current ->
            var next = current.copy(
                focus = RouteFocusState(
                    target = focus.target,
                    requestId = focus.requestId,
                    messageId = focus.messageId,
                    seq = focus.seq,
                    resolved = focus.resolved,
                    messageIndex = focus.messageIndex,
                ),
            )
            if (focus.target == "approval" && focus.resolved) {
                val live = current.approval
                val matches = live != null && (live.requestId == route.requestId || live.id == route.requestId)
                if (!matches) {
                    next = next.copy(
                        approval = PendingApproval(
                            id = "push-${route.requestId}",
                            sessionId = route.sessionId,
                            requestId = route.requestId,
                            description = route.body.ifBlank { route.title }.ifBlank { "Approval" },
                            command = "",
                            resolvedLabel = "Resolved",
                        ),
                        showCommand = false,
                    )
                }
            }
            if (focus.target == "question") {
                val live = current.question
                val matches = live != null && (live.requestId == route.requestId || live.id == route.requestId)
                if (!matches) {
                    next = next.copy(
                        question = PendingQuestion(
                            id = "push-${route.requestId}",
                            sessionId = route.sessionId,
                            requestId = route.requestId,
                            text = route.body.ifBlank { route.title }.ifBlank { "Question" },
                            resolvedLabel = if (focus.resolved) "Resolved" else null,
                        ),
                    )
                }
            }
            next
        }
        val choice = route.action
        if (!focus.resolved && (choice == "once" || choice == "deny") && focus.target == "approval") {
            val card = _state.value.approval
            if (card != null && card.resolvedLabel == null && (card.requestId == route.requestId || card.id == route.requestId)) {
                answer(choice)
            }
        }
    }

    private fun messageIdFrom(payload: JSONObject): String {
        val turn = payload.optJSONObject("persisted_turn") ?: return ""
        val row = turn.opt("final_assistant_row_id")
        if (row != null && row != JSONObject.NULL) {
            return row.toString()
        }
        return turn.optString("submission_id")
    }

    private fun forgetApproval(id: String, reason: String?) {
        if (id.isEmpty()) return
        resolvedApprovals.add(id)
        _state.update { current ->
            val card = current.approval ?: return@update current
            if (card.id != id && card.requestId != id) return@update current
            resolvedApprovals.add(card.id)
            if (answeredHere.contains(card.id) || reason != "resolved") {
                current.copy(approval = null, showCommand = false)
            } else {
                current.copy(approval = card.copy(resolvedLabel = "Approved on another device"), showCommand = false)
            }
        }
    }

    private fun syncOpenApprovals(open: List<ServerRequest>) {
        val ids = open.filter { it.method == "approval" }.map { it.id }.toSet()
        _state.update { current ->
            val card = current.approval ?: return@update current
            if (card.resolvedLabel != null || resolvedApprovals.contains(card.id)) return@update current
            if (card.id !in ids) current.copy(approval = null, showCommand = false) else current
        }
    }

    private fun scheduleReconnect() {
        if (reconnectJob?.isActive == true) return
        reconnectJob = viewModelScope.launch {
            var wait = 1_000L
            _state.update { it.copy(reconnecting = true, connected = false, status = "Reconnecting") }
            while (true) {
                delay(wait)
                val saved = secure.load()
                if (saved == null || saved.refreshToken.isEmpty()) {
                    _state.update {
                        val status = if (it.status.startsWith("Sign in again")) it.status else "Sign in again"
                        it.copy(reconnecting = false, status = status)
                    }
                    return@launch
                }
                try {
                    restore(saved)
                    if (_state.value.connected) return@launch
                } catch (error: Exception) {
                    if (error is HermesException && error.status == 401) {
                        secure.clearSecret()
                        _state.update { it.copy(reconnecting = false, connected = false, username = saved.username, status = "Sign in again") }
                        return@launch
                    }
                }
                wait = (wait * 2).coerceAtMost(15_000)
            }
        }
    }

    fun checkForUpdate() {
        val base = _state.value.updateBase.trim().trimEnd('/')
        val url = "$base/latest.json"
        viewModelScope.launch {
            _state.update { it.copy(updatePhase = "checking", updateDetail = "") }
            try {
                val raw = withContext(Dispatchers.IO) {
                    val response = http.newCall(Request.Builder().url(url).build()).execute()
                    response.use { body ->
                        val text = body.body?.string().orEmpty()
                        if (!body.isSuccessful) {
                            throw IllegalStateException("Update check failed (${body.code}) from $url. ${text.take(180)}")
                        }
                        text
                    }
                }
                val parsed = parseLatest(raw)
                    ?: throw IllegalStateException("Update check failed from $url. latest.json is not the expected shape.")
                pendingRelease = parsed
                if (updateAvailable(BuildConfig.HERMES_BUILD, parsed.build)) {
                    _state.update { it.copy(updatePhase = "available", updateVersion = parsed.version, updateDetail = "") }
                } else {
                    _state.update { it.copy(updatePhase = "current", updateVersion = "", updateDetail = "") }
                }
            } catch (error: Exception) {
                pendingRelease = null
                val message = error.message?.takeIf { it.isNotBlank() } ?: error.javaClass.simpleName
                val detail = if (message.contains(url)) message else "Update check failed from $url. $message"
                _state.update { it.copy(updatePhase = "error", updateDetail = detail) }
            }
        }
    }

    fun applyUpdate(activity: Activity) {
        val artifact = pendingRelease?.android ?: return
        viewModelScope.launch {
            _state.update { it.copy(updatePhase = "working", updateDetail = "Downloading the update") }
            try {
                val file = withContext(Dispatchers.IO) { downloadVerified(artifact) }
                val blocked = withContext(Dispatchers.Main) { installDownloadedApk(activity, file) }
                _state.update {
                    it.copy(
                        updatePhase = "available",
                        updateDetail = blocked ?: "Confirm the install in the system dialog.",
                    )
                }
            } catch (error: Exception) {
                val message = error.message?.takeIf { it.isNotBlank() } ?: error.javaClass.simpleName
                _state.update { it.copy(updatePhase = "available", updateDetail = message) }
            }
        }
    }

    private fun downloadVerified(file: ReleaseFile): File {
        val client = http.newBuilder().readTimeout(120, TimeUnit.SECONDS).build()
        val response = client.newCall(Request.Builder().url(file.url).build()).execute()
        response.use { resp ->
            if (!resp.isSuccessful) {
                val text = resp.body?.string().orEmpty().take(180)
                throw IllegalStateException("Download failed (${resp.code}) from ${file.url}. $text")
            }
            val body = resp.body ?: throw IllegalStateException("Download failed from ${file.url}. The body was empty.")
            val dir = File(getApplication<Application>().cacheDir, "updates").apply { mkdirs() }
            val out = File(dir, "hermes-bots-update.apk")
            val digest = MessageDigest.getInstance("SHA-256")
            var total = 0L
            body.byteStream().use { input ->
                out.outputStream().use { output ->
                    val buffer = ByteArray(8192)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        if (file.size > 0 && total > file.size) {
                            throw IllegalStateException("Download from ${file.url} is larger than ${file.size} bytes.")
                        }
                        digest.update(buffer, 0, read)
                        output.write(buffer, 0, read)
                    }
                }
            }
            if (file.size > 0 && total != file.size) {
                throw IllegalStateException("Download size mismatch from ${file.url}. Expected ${file.size} bytes, got $total.")
            }
            val actual = digest.digest().joinToString("") { "%02x".format(it) }
            if (!actual.equals(file.sha256.trim(), ignoreCase = true)) {
                throw IllegalStateException("SHA-256 mismatch for ${file.url}. Expected ${file.sha256}, got $actual.")
            }
            return out
        }
    }

    override fun onCleared() {
        intentionalClose = true
        client?.close()
        super.onCleared()
    }
}
