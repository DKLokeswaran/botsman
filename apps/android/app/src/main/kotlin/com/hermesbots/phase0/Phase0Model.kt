package com.hermesbots.phase0

import android.app.Application
import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hermesbots.gateway.GatewayEvent
import com.hermesbots.gateway.HermesClient
import com.hermesbots.gateway.HermesException
import com.hermesbots.gateway.HermesListener
import com.hermesbots.gateway.LoginMaterial
import com.hermesbots.gateway.ProfileRow
import com.hermesbots.gateway.ServerRequest
import com.hermesbots.gateway.SessionRow
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
import org.json.JSONObject

private const val DEFAULT_SERVER = "http://100.113.35.96:9119"
private const val LEGACY_SERVER = "http://devbox.tail2eeb02.ts.net:9119"

data class ChatLine(val role: String, val text: String)
data class PendingApproval(
    val id: String,
    val sessionId: String,
    val requestId: String,
    val description: String,
    val command: String,
)
data class StagedFile(val name: String, val image: ImageBitmap?)

data class Phase0State(
    val serverUrl: String = DEFAULT_SERVER,
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
                    _state.update { current ->
                        val lines = current.messages.toMutableList()
                        val body = text.ifEmpty { event.payload.optString("error", "Reply finished") }
                        if (lines.lastOrNull()?.role == "assistant") {
                            lines[lines.lastIndex] = ChatLine("assistant", body)
                        } else {
                            lines.add(ChatLine(if (failed) "error" else "assistant", body))
                        }
                        current.copy(messages = lines, status = if (failed) "Reply failed" else "Connected")
                    }
                }
                "error" -> {
                    val text = event.payload.optString("message", event.payload.optString("text", "Error"))
                    _state.update { it.copy(messages = it.messages + ChatLine("error", text), status = "Error") }
                }
            }
        }

        override fun onServerRequest(request: ServerRequest) {
            if (request.method == "approval") {
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
        _state.update {
            it.copy(
                serverUrl = serverUrl,
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
    }

    fun update(serverUrl: String? = null, username: String? = null, password: String? = null, draft: String? = null, ime: String? = null) {
        _state.update {
            it.copy(
                serverUrl = serverUrl ?: it.serverUrl,
                username = username ?: it.username,
                password = password ?: it.password,
                draft = draft ?: it.draft,
                ime = ime ?: it.ime,
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

    fun openSession(sessionId: String) {
        viewModelScope.launch {
            val current = client ?: return@launch
            try {
                val opened = withContext(Dispatchers.IO) { current.resumeSession(sessionId) }
                val history = withContext(Dispatchers.IO) { current.history(opened.first) }
                _state.update {
                    it.copy(
                        liveSessionId = opened.first,
                        messages = history.map { row -> ChatLine(row.role.ifEmpty { "assistant" }, row.text) },
                        status = "Connected",
                    )
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
                _state.update { it.copy(liveSessionId = id, messages = emptyList(), status = "New session") }
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
        client?.respond(card.id, JSONObject().put("choice", choice))
        _state.update { it.copy(approval = null, showCommand = false, status = if (choice == "deny") "Denied" else "Allowed once") }
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

    fun notePush(body: String) {
        _state.update { it.copy(pushBody = body) }
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
            if (live != null) {
                val replay = withContext(Dispatchers.IO) { next.replay(live, seqs[live] ?: 0) }
                if (replay.truncated) {
                    openSession(live)
                }
            }
        }
    }

    private suspend fun refreshLists() {
        val current = client ?: return
        val profiles = withContext(Dispatchers.IO) { current.listProfiles() }
        val sessions = withContext(Dispatchers.IO) { current.listSessions() }
        _state.update { it.copy(profiles = profiles, sessions = sessions) }
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

    override fun onCleared() {
        intentionalClose = true
        client?.close()
        super.onCleared()
    }
}
