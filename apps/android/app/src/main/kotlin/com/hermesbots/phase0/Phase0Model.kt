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
import com.hermesbots.gateway.RECONNECT_BACKOFF_CAP_MS
import com.hermesbots.gateway.RESUME_RETRY_MS
import com.hermesbots.gateway.ReleaseFile
import com.hermesbots.gateway.ResumedSession
import com.hermesbots.gateway.ServerRequest
import com.hermesbots.gateway.SessionRow
import com.hermesbots.gateway.TrackedMessage
import com.hermesbots.gateway.formatAppVersion
import com.hermesbots.gateway.isSessionAttachFailure
import com.hermesbots.gateway.openRequestIds
import com.hermesbots.gateway.parseLatest
import com.hermesbots.gateway.parsePush
import com.hermesbots.gateway.reconnectDelayMs
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
    val awaitingTool: Boolean = false,
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
    private val approvalLock = Any()
    private var approvals: Map<String, PendingApproval> = emptyMap()
    private val clearJobs = mutableMapOf<String, Job>()
    private var replaying = false
    private var refreshTail: Job? = null
    private var pendingRoute: PushRoute? = null
    private var pendingRelease: LatestRelease? = null
    private var reconnectJob: Job? = null
    private var intentionalClose = false
    private val resumeRetryAfter = mutableMapOf<String, Long>()

    private val _state = MutableStateFlow(Phase0State())
    val state: StateFlow<Phase0State> = _state

    private val listener = object : HermesListener {
        override fun onEvent(event: GatewayEvent) {
            val seq = event.seq
            if (seq != null && event.sessionId.isNotEmpty()) {
                seqs[event.sessionId] = maxOf(seqs[event.sessionId] ?: 0, seq)
            }
            if (event.type == "request.cancel") {
                noteResolved(event.payload.optString("id"))
                val requestId = event.payload.optString("id")
                val reason = event.payload.optString("reason")
                val answered = answeredHere.toSet()
                applyApproval(settle = true) { book -> onRequestCancel(book, requestId, reason, answered) }
                return
            }
            if (event.type == "approval.cancelled") {
                val ids = event.payload.optJSONArray("request_ids")
                val requestIds = mutableListOf<String>()
                if (ids != null) {
                    for (index in 0 until ids.length()) {
                        val id = ids.optString(index)
                        if (id.isNotEmpty()) {
                            noteResolved(id)
                            requestIds.add(id)
                            dismissApprovalNotification(getApplication(), id)
                        }
                    }
                }
                applyApproval(settle = true) { book -> onApprovalCancelled(book, requestIds) }
                return
            }
            if (event.type == "sessions.changed") {
                if (!replaying) refreshLive(attach = true)
                return
            }
            if (event.type == "tool.complete") {
                val text = toolResultText(
                    jsonText(event.payload.opt("result")),
                    jsonText(event.payload.opt("result_text")),
                    jsonText(event.payload.opt("summary")),
                )
                val sessionId = event.sessionId.ifEmpty { _state.value.liveSessionId.orEmpty() }
                if (sessionId.isNotEmpty()) applyApproval { book -> onToolComplete(book, sessionId, text) }
                return
            }
            if (event.type == "message.start" || event.type == "message.delta" || event.type == "message.complete" || event.type == "error") {
                if (event.sessionId.isNotEmpty()) applyApproval { book -> onNewerMessage(book, event.sessionId) }
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
                val sessionId = request.params.optString("session_id").ifEmpty { _state.value.liveSessionId.orEmpty() }
                val card = PendingApproval(
                    id = request.id,
                    sessionId = sessionId,
                    requestId = request.params.optString("request_id"),
                    description = request.params.optString("description").ifEmpty { "Approval needed" },
                    command = request.params.optString("command"),
                )
                val resolved = resolvedApprovals.toSet()
                applyApproval { book -> rememberOpen(book, card, resolved) }
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
        val credentials = credentialsForLogin(snapshot.username, snapshot.password)
        viewModelScope.launch {
            _state.update { it.copy(status = "Signing in", username = credentials.username, password = "") }
            plain.edit().putString("server_url", snapshot.serverUrl).apply()
            try {
                val fresh = withContext(Dispatchers.IO) {
                    val signing = HermesClient(snapshot.serverUrl, http)
                    try {
                        signing.login(credentials.username, credentials.password)
                    } finally {
                        signing.close()
                    }
                }
                establish(fresh)
            } catch (error: Exception) {
                val message = if (error is HermesException) {
                    loginFailureStatus(error.status, error.message ?: "Login failed", credentials.password)
                } else {
                    error.message ?: "Login failed"
                }
                _state.update { it.copy(status = message, connected = false, username = credentials.username) }
            }
        }
    }

    fun openSession(sessionId: String, profile: String = "") {
        viewModelScope.launch {
            val current = client ?: return@launch
            if (resumeBlocked(sessionId)) return@launch
            _state.update { it.copy(question = null) }
            try {
                val opened = withContext(Dispatchers.IO) { current.resumeSession(sessionId, profile.ifBlank { null }) }
                val history = withContext(Dispatchers.IO) { current.history(opened.sessionId) }
                val rows = history.map { row -> HistoryEntry(row.role, row.text, row.rowId) }
                var shown = emptyList<ChatLine>()
                _state.update { currentState ->
                    val switching = currentState.liveSessionId != opened.sessionId
                    val lines = if (switching) {
                        rows.map { row -> ChatLine(row.role.ifEmpty { "assistant" }, row.text, messageId = row.rowId) }
                    } else {
                        mergeHistory(currentState.messages, rows)
                    }
                    shown = lines
                    val card = approvalFor(opened.sessionId)
                    currentState.copy(
                        liveSessionId = opened.sessionId,
                        messages = lines,
                        approval = card,
                        showCommand = if (card?.id != currentState.approval?.id || card?.resolvedLabel != null) false else currentState.showCommand,
                        status = "Connected",
                    )
                }
                syncOpenApprovals(opened.sessionId, opened.openRequests)
                val route = pendingRoute
                if (route != null && (route.sessionId.isEmpty() || route.sessionId == opened.sessionId)) {
                    pendingRoute = null
                    placeFocus(route, opened.openRequests, shown)
                }
            } catch (error: Exception) {
                if (isSessionAttachFailure(error)) {
                    markResumeBlocked(sessionId)
                    dropStaleSession(sessionId)
                } else {
                    _state.update { it.copy(status = error.message ?: "Could not open the session") }
                }
            }
        }
    }

    fun onForeground() {
        refreshLive(attach = true)
    }

    fun newSession() {
        viewModelScope.launch {
            val current = client ?: return@launch
            try {
                val id = withContext(Dispatchers.IO) { current.createSession() }
                withContext(Dispatchers.IO) { current.resumeSession(id) }
                _state.update {
                    it.copy(
                        liveSessionId = id,
                        messages = emptyList(),
                        approval = approvalFor(id),
                        question = null,
                        focus = null,
                        showCommand = false,
                        status = "New session",
                    )
                }
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
        applyApproval { book -> onNewerMessage(book, session) }
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
        applyApproval(settle = true) { book -> noteLocalChoice(book, card, choice) }
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { current.answerApproval(card.sessionId, card.requestId, choice) }
                _state.update { it.copy(status = choiceLabel(choice)) }
            } catch (error: Exception) {
                answeredHere.remove(card.id)
                resolvedApprovals.remove(card.id)
                applyApproval { book -> restoreOpen(book, card) }
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

    private suspend fun restore(saved: SavedLogin): Int? {
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
            return null
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
            return if (error is HermesException) error.retryAfter else null
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
                val resumed = resumeOrDrop(next, live) ?: return@withLock
                mergeOpenHistory(next, resumed.sessionId)
                replaying = true
                val replay = try {
                    withContext(Dispatchers.IO) { next.replay(resumed.sessionId, seqs[resumed.sessionId] ?: 0) }
                } finally {
                    replaying = false
                }
                syncOpenApprovals(resumed.sessionId, replay.openRequests)
                mergeOpenHistory(next, resumed.sessionId)
                if (replay.truncated) {
                    openSession(resumed.sessionId)
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
        val resolvedSession = route.sessionId.ifEmpty { _state.value.liveSessionId.orEmpty() }
        if (focus.target == "approval" && focus.resolved && resolvedSession.isNotEmpty()) {
            synchronized(approvalLock) {
                val live = approvals[resolvedSession]
                val matches = live != null && (live.requestId == route.requestId || live.id == route.requestId)
                if (!matches) {
                    approvals = approvals + (
                        resolvedSession to PendingApproval(
                            id = "push-${route.requestId}",
                            sessionId = resolvedSession,
                            requestId = route.requestId,
                            description = route.body.ifBlank { route.title }.ifBlank { "Approval" },
                            command = "",
                            resolvedLabel = "Resolved",
                        )
                        )
                }
            }
        }
        val resolvedCard = if (focus.target == "approval" && focus.resolved) approvalFor(resolvedSession) else null
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
            if (resolvedCard != null && current.liveSessionId == resolvedSession) {
                next = next.copy(approval = resolvedCard, showCommand = false)
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
        if (focus.target == "approval" && focus.resolved && route.requestId.isNotEmpty()) {
            dismissApprovalNotification(getApplication(), route.requestId)
        }
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

    private fun noteResolved(id: String) {
        if (id.isEmpty()) return
        resolvedApprovals.add(id)
    }

    private fun jsonText(value: Any?): String {
        if (value == null || value == JSONObject.NULL) return ""
        return value.toString()
    }

    private fun approvalFor(sessionId: String): PendingApproval? = synchronized(approvalLock) { approvals[sessionId] }

    private fun applyApproval(settle: Boolean = false, transform: (Map<String, PendingApproval>) -> ApprovalResult) {
        val published: PendingApproval?
        val effects: List<ApprovalEffect>
        var leaving = emptyList<String>()
        synchronized(approvalLock) {
            val result = transform(approvals)
            for (effect in result.effects) {
                if (effect.type == "disarm") clearJobs.remove(effect.sessionId)?.cancel()
            }
            val previous = approvals
            approvals = result.book
            leaving = idsLeavingOpen(previous, approvals)
            if (settle) {
                for ((sessionId, card) in previous) {
                    val now = approvals[sessionId]
                    if (now == null || now.id != card.id || (now.resolvedLabel != null && card.resolvedLabel == null)) {
                        noteResolved(card.id)
                        if (card.requestId.isNotEmpty()) noteResolved(card.requestId)
                    }
                }
            }
            published = _state.value.liveSessionId?.let { approvals[it] }
            effects = result.effects
        }
        for (id in leaving) dismissApprovalNotification(getApplication(), id)
        _state.update { current ->
            val sameCard = published?.id == current.approval?.id
            current.copy(
                approval = published,
                showCommand = if (!sameCard || published?.resolvedLabel != null) false else current.showCommand,
            )
        }
        for (effect in effects) {
            if (effect.type == "arm") armClear(effect.sessionId)
        }
    }

    private fun armClear(sessionId: String) {
        val job = viewModelScope.launch {
            delay(RESOLVED_CARD_MS)
            applyApproval { book -> expireResolved(book, sessionId) }
        }
        val previous = synchronized(approvalLock) {
            val replaced = clearJobs.remove(sessionId)
            clearJobs[sessionId] = job
            replaced
        }
        previous?.cancel()
    }

    private fun syncOpenApprovals(sessionId: String, open: List<ServerRequest>) {
        val ids = open.filter { it.method == "approval" }.map { it.id }.toSet()
        applyApproval { book -> syncOpen(book, sessionId, ids) }
    }

    private fun refreshLive(attach: Boolean) {
        val earlier = refreshTail
        refreshTail = viewModelScope.launch {
            earlier?.join()
            val current = client ?: return@launch
            if (!_state.value.connected) return@launch
            try {
                val sessions = withContext(Dispatchers.IO) { current.listSessions() }
                _state.update { it.copy(sessions = sessions) }
                val live = _state.value.liveSessionId ?: return@launch
                if (attach) {
                    try {
                        withContext(Dispatchers.IO) { current.resumeSession(live) }
                    } catch (error: Exception) {
                        if (isSessionAttachFailure(error)) {
                            markResumeBlocked(live)
                            dropStaleSession(live)
                            return@launch
                        }
                        // History can still move if this socket was already attached.
                    }
                }
                mergeOpenHistory(current, live)
            } catch (_: Exception) {
                // A missed refresh is retried on the next sessions.changed or foreground.
            }
        }
    }

    private suspend fun mergeOpenHistory(current: HermesClient, live: String) {
        val history = withContext(Dispatchers.IO) { current.history(live) }
        val rows = history.map { row -> HistoryEntry(row.role, row.text, row.rowId) }
        var grew = false
        _state.update { state ->
            if (state.liveSessionId != live) return@update state
            val merged = mergeHistory(state.messages, rows)
            grew = transcriptGrew(state.messages, merged)
            if (sameTranscript(state.messages, merged)) state else state.copy(messages = merged)
        }
        if (grew) applyApproval { book -> onNewerMessage(book, live) }
    }

    private fun scheduleReconnect() {
        if (reconnectJob?.isActive == true) return
        reconnectJob = viewModelScope.launch {
            var wait = 1_000L
            _state.update { it.copy(reconnecting = true, connected = false, status = "Reconnecting") }
            while (true) {
                val saved = secure.load()
                if (saved == null || saved.refreshToken.isEmpty()) {
                    _state.update {
                        val status = if (it.status.startsWith("Sign in again")) it.status else "Sign in again"
                        it.copy(reconnecting = false, status = status)
                    }
                    return@launch
                }
                var retryAfter: Int? = null
                retryAfter = restore(saved)
                if (_state.value.connected) return@launch
                if (!_state.value.reconnecting) return@launch
                wait = (wait * 2).coerceAtMost(RECONNECT_BACKOFF_CAP_MS)
                delay(reconnectDelayMs(wait, retryAfter))
            }
        }
    }

    private fun resumeBlocked(sessionId: String): Boolean =
        System.currentTimeMillis() < (resumeRetryAfter[sessionId] ?: 0L)

    private fun markResumeBlocked(sessionId: String) {
        resumeRetryAfter[sessionId] = System.currentTimeMillis() + RESUME_RETRY_MS
    }

    private suspend fun resumeOrDrop(client: HermesClient, sessionId: String, profile: String? = null): ResumedSession? {
        if (resumeBlocked(sessionId)) {
            dropStaleSession(sessionId)
            return null
        }
        try {
            return withContext(Dispatchers.IO) { client.resumeSession(sessionId, profile) }
        } catch (error: Exception) {
            if (!isSessionAttachFailure(error)) throw error
            markResumeBlocked(sessionId)
            dropStaleSession(sessionId)
            return null
        }
    }

    private fun dropStaleSession(sessionId: String) {
        resumeRetryAfter.remove(sessionId)
        seqs.remove(sessionId)
        applyApproval { book -> ApprovalResult(book.filterKeys { it != sessionId }, emptyList()) }
        _state.update { current ->
            if (current.liveSessionId != null && current.liveSessionId != sessionId) return@update current
            afterStaleSessionDropped(current)
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
        if (!UpdateDownload.tryBeginDownload()) {
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(updatePhase = "working", updateDetail = UpdateDownload.formatProgress(0, artifact.size.takeIf { it > 0 })) }
            try {
                val file = withContext(Dispatchers.IO) {
                    downloadVerified(artifact) { received, total ->
                        _state.update { current ->
                            current.copy(updateDetail = UpdateDownload.formatProgress(received, total))
                        }
                    }
                }
                val blocked = withContext(Dispatchers.Main) { installDownloadedApk(activity, file) }
                _state.update {
                    it.copy(
                        updatePhase = "available",
                        updateDetail = blocked ?: "Confirm the install in the system dialog.",
                    )
                }
            } catch (error: Exception) {
                val message = error.message?.takeIf { it.isNotBlank() } ?: error.javaClass.simpleName
                _state.update { it.copy(updatePhase = "error", updateDetail = message) }
            } finally {
                UpdateDownload.endDownload()
            }
        }
    }

    private fun downloadVerified(file: ReleaseFile, onProgress: (Long, Long?) -> Unit): File {
        val client = http.newBuilder().readTimeout(120, TimeUnit.SECONDS).build()
        val response = client.newCall(Request.Builder().url(file.url).build()).execute()
        response.use { resp ->
            if (!resp.isSuccessful) {
                val text = resp.body?.string().orEmpty().take(180)
                throw IllegalStateException("Download failed (${resp.code}) from ${file.url}. $text")
            }
            val body = resp.body ?: throw IllegalStateException("Download failed from ${file.url}. The body was empty.")
            val build = pendingRelease?.build ?: 0
            val dir = File(getApplication<Application>().cacheDir, "updates").apply { mkdirs() }
            val stem = UpdateDownload.apkStem(build)
            val part = File(dir, "$stem.part")
            val out = File(dir, "$stem.apk")
            UpdateDownload.pruneLeftovers(dir, part)
            if (part.exists()) {
                part.delete()
            }
            val digest = MessageDigest.getInstance("SHA-256")
            var total = 0L
            val expectedTotal = file.size.takeIf { it > 0 }
            onProgress(0, expectedTotal)
            body.byteStream().use { input ->
                part.outputStream().use { output ->
                    val buffer = ByteArray(8192)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        if (file.size > 0 && total > file.size) {
                            part.delete()
                            throw IllegalStateException("Download from ${file.url} is larger than ${file.size} bytes.")
                        }
                        digest.update(buffer, 0, read)
                        output.write(buffer, 0, read)
                        onProgress(total, expectedTotal)
                    }
                }
            }
            if (file.size > 0 && total != file.size) {
                part.delete()
                throw IllegalStateException("Download size mismatch from ${file.url}. Expected ${file.size} bytes, got $total.")
            }
            val actual = digest.digest().joinToString("") { "%02x".format(it) }
            if (!actual.equals(file.sha256.trim(), ignoreCase = true)) {
                part.delete()
                throw IllegalStateException("SHA-256 mismatch for ${file.url}. Expected ${file.sha256}, got $actual.")
            }
            if (!part.renameTo(out)) {
                part.copyTo(out, overwrite = true)
                part.delete()
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
