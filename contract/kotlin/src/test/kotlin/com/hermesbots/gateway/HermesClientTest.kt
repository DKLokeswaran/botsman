package com.hermesbots.gateway

import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import okhttp3.OkHttpClient
import org.json.JSONObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class HermesClientTest {
    @Test
    fun loginTicketAndRefresh() = withFake { port, http ->
        val gateway = HermesClient("http://127.0.0.1:$port", http)
        try {
            val rejected = assertThrows<HermesException> {
                runBlocking { gateway.login("tester", "nope") }
            }
            assertEquals(401, rejected.status)
            assertEquals("Login failed (401: Invalid credentials)", rejected.message)
            assertTrue(!rejected.message!!.contains("nope"))
            val material = runBlocking { gateway.login("tester", "tester") }
            assertEquals("tester", material.username)
            assertTrue(material.accessToken.startsWith("at."))
            assertTrue(material.refreshToken.startsWith("rt."))
            assertEquals("basic", material.provider)

            val bare = HermesClient("http://127.0.0.1:$port", http)
            assertThrows<HermesException> {
                runBlocking { bare.ticket("not-a-token") }
            }

            val ticket = runBlocking { gateway.ticket(material.accessToken) }
            val opened = kotlinx.coroutines.CompletableDeferred<Unit>()
            val closed = kotlinx.coroutines.CompletableDeferred<Unit>()
            val socket = http.newWebSocket(
                okhttp3.Request.Builder().url("ws://127.0.0.1:$port/api/ws?ticket=$ticket").build(),
                object : okhttp3.WebSocketListener() {
                    override fun onOpen(webSocket: okhttp3.WebSocket, response: okhttp3.Response) {
                        opened.complete(Unit)
                    }

                    override fun onClosed(webSocket: okhttp3.WebSocket, code: Int, reason: String) {
                        closed.complete(Unit)
                    }

                    override fun onFailure(webSocket: okhttp3.WebSocket, t: Throwable, response: okhttp3.Response?) {
                        opened.completeExceptionally(t)
                        closed.completeExceptionally(t)
                    }
                },
            )
            runBlocking { kotlinx.coroutines.withTimeout(5_000) { opened.await() } }
            socket.close(1000, "done")
            runBlocking { kotlinx.coroutines.withTimeout(5_000) { closed.await() } }
            val failed = kotlinx.coroutines.CompletableDeferred<Throwable?>()
            http.newWebSocket(
                okhttp3.Request.Builder().url("ws://127.0.0.1:$port/api/ws?ticket=$ticket").build(),
                object : okhttp3.WebSocketListener() {
                    override fun onOpen(webSocket: okhttp3.WebSocket, response: okhttp3.Response) {
                        failed.complete(null)
                    }

                    override fun onFailure(webSocket: okhttp3.WebSocket, t: Throwable, response: okhttp3.Response?) {
                        failed.complete(t)
                    }
                },
            )
            val error = kotlinx.coroutines.runBlocking { kotlinx.coroutines.withTimeout(5_000) { failed.await() } }
            assertTrue(error != null, "a used ticket must be rejected")

            val rotated = runBlocking { gateway.refresh(material) }
            assertNotEquals(material.accessToken, rotated.accessToken)
            val expired = assertThrows<HermesException> {
                runBlocking { gateway.refresh(material) }
            }
            assertEquals(401, expired.status)
            assertEquals("Refresh failed (401: Session expired)", expired.message)
            assertTrue(!expired.message!!.contains(material.refreshToken))
        } finally {
            gateway.close()
        }
    }

    @Test
    fun loginDetailAndTransportError() {
        val hostHeader = httpFailureMessage(
            "Login failed",
            400,
            """{"detail":"Invalid Host header. Dashboard requests must use the bound hostname or the configured public hostname."}""",
        )
        assertEquals(
            "Login failed (400: Invalid Host header. Dashboard requests must use the bound hostname or the configured public hostname.)",
            hostHeader,
        )
        val transport = transportFailureMessage(
            "Login failed",
            "http://100.113.35.96:9119/auth/password-login",
            IOException("url not allowed on the configured scope: http://100.113.35.96:9119/auth/password-login password=secret-value Bearer sekret"),
        )
        assertTrue(transport.contains("url not allowed on the configured scope"))
        assertTrue(transport.contains("http://100.113.35.96:9119/auth/password-login"))
        assertTrue(!transport.contains("secret-value"))
        assertTrue(!transport.contains("sekret"))

        val gateway = HermesClient(
            "http://127.0.0.1:1",
            OkHttpClient.Builder().connectTimeout(2, TimeUnit.SECONDS).readTimeout(2, TimeUnit.SECONDS).build(),
        )
        try {
            val error = assertThrows<HermesException> {
                runBlocking { gateway.login("tester", "secret-value") }
            }
            assertEquals(null, error.status)
            assertTrue(error.message!!.contains("http://127.0.0.1:1/auth/password-login"), error.message)
            assertTrue(!error.message!!.contains("secret-value"))
        } finally {
            gateway.close()
        }
    }

    @Test
    fun handshakeApprovalAndReplay() = withFake { port, http ->
        val gateway = HermesClient("http://127.0.0.1:$port", http)
        try {
            val material = runBlocking { gateway.login("tester", "tester") }
            val outcome = runBlocking {
                val approvalJob = async { gateway.waitForServerRequest("approval") }
                val completeJob = async { gateway.waitForEvent("message.complete") }
                yield()
                val ready = gateway.connect(material.accessToken)
                assertEquals("epoch-phase0", ready.replayEpoch)
                assertTrue(ready.heartbeat)
                assertEquals(false, ready.sessionAuthority)
                val profiles = gateway.listProfiles()
                assertEquals("Junior", profiles.first().displayName)
                val sessions = gateway.listSessions()
                assertEquals("sess-1", sessions.first().id)
                val opened = gateway.resumeSession("sess-1")
                assertEquals("live-1", opened.sessionId)
                assertEquals("Say hello", opened.messages.first().text)
                gateway.submit("live-1", "Say hello")
                approvalJob.await() to completeJob.await()
            }
            val request = outcome.first
            assertEquals("approval", request.method)
            assertEquals("Read the repo status", request.params.optString("description"))
            val seen = outcome.second
            assertEquals("Hello from Hermes", seen.payload.optString("text"))
            assertTrue((seen.seq ?: 0) >= 3)
            gateway.close()

            val again = HermesClient("http://127.0.0.1:$port", http)
            try {
                runBlocking {
                    val restoredJob = async { again.waitForServerRequest("approval") }
                    yield()
                    val rotated = again.refresh(material)
                    again.connect(rotated.accessToken)
                    val replay = again.replay("live-1", 1)
                    assertEquals(false, replay.truncated)
                    assertEquals("epoch-phase0", replay.epoch)
                    assertTrue(replay.events.any { it.seq == seen.seq && it.type == "message.complete" })
                    val card = restoredJob.await()
                    assertEquals(request.id, card.id)
                    again.respond(card.id, JSONObject().put("choice", "once"))
                    again.noteApprovalVisible("live-1", card.params.optString("request_id"))
                }
            } finally {
                again.close()
            }
        } finally {
            gateway.close()
        }
    }

    @Test
    fun twoClientsShareOneApproval() = withFake { port, http ->
        val first = HermesClient("http://127.0.0.1:$port", http)
        val second = HermesClient("http://127.0.0.1:$port", http)
        try {
            val material = runBlocking { first.login("tester", "tester") }
            val (card, other, cancel) = runBlocking {
                val firstCard = async { first.waitForServerRequest("approval") }
                val secondCard = async { second.waitForServerRequest("approval") }
                val cancelJob = async { second.waitForEvent("request.cancel") }
                yield()
                first.connect(material.accessToken)
                second.connect(material.accessToken)
                val left = firstCard.await()
                val right = secondCard.await()
                first.resumeSession(left.params.optString("session_id"))
                second.resumeSession(right.params.optString("session_id"))
                first.answerApproval(
                    left.params.optString("session_id"),
                    left.params.optString("request_id"),
                    "once",
                )
                Triple(left, right, cancelJob.await())
            }
            assertEquals(card.id, other.id)
            assertEquals(card.id, cancel.payload.optString("id"))
            assertEquals("approval", cancel.payload.optString("method"))
            assertEquals("resolved", cancel.payload.optString("reason"))
            val replay = runBlocking { second.replay("live-1", 0) }
            assertTrue(replay.openRequests.none { it.id == card.id })
        } finally {
            first.close()
            second.close()
        }
    }

    @Test
    fun test_bug_message_from_socket_a_appears_for_socket_b() = withFake { port, http ->
        val first = HermesClient("http://127.0.0.1:$port", http)
        val second = HermesClient("http://127.0.0.1:$port", http)
        val third = HermesClient("http://127.0.0.1:$port", http)
        try {
            val material = runBlocking { first.login("tester", "tester") }
            val history = runBlocking {
                first.connect(material.accessToken)
                second.connect(material.accessToken)
                third.connect(material.accessToken)
                first.resumeSession("sess-1")
                second.resumeSession("sess-1")
                val created = third.createSession()
                assertTrue(created != "live-1")
                third.resumeSession(created)
                val seen = java.util.Collections.synchronizedList(mutableListOf<String>())
                third.listener = object : HermesListener {
                    override fun onEvent(event: GatewayEvent) {
                        seen.add(event.type)
                    }
                }
                val changed = async { third.waitForEvent("sessions.changed") }
                val done = async { second.waitForEvent("message.complete") }
                yield()
                first.submit("live-1", "from the other phone")
                changed.await()
                done.await()
                seen.toList() to second.history("live-1")
            }
            assertTrue(history.second.any { it.text == "from the other phone" })
            assertTrue("message.complete" !in history.first)
            assertTrue("message.delta" !in history.first)
            assertTrue("sessions.changed" in history.first)
        } finally {
            first.close()
            second.close()
            third.close()
        }
    }

    @Test
    fun test_bug_deny_cancel_has_no_choice() = withFake { port, http ->
        val first = HermesClient("http://127.0.0.1:$port", http)
        val second = HermesClient("http://127.0.0.1:$port", http)
        try {
            val material = runBlocking { first.login("tester", "tester") }
            val (cancel, tool) = runBlocking {
                first.connect(material.accessToken)
                second.connect(material.accessToken)
                first.resumeSession("sess-1")
                second.resumeSession("sess-1")
                val cancelJob = async { second.waitForEvent("request.cancel") }
                val toolJob = async { second.waitForEvent("tool.complete") }
                yield()
                first.answerApproval("live-1", "req-1", "deny")
                cancelJob.await() to toolJob.await()
            }
            assertEquals("resolved", cancel.payload.optString("reason"))
            assertEquals("approval", cancel.payload.optString("method"))
            assertTrue(!cancel.payload.has("choice"))
            assertTrue(tool.payload.optString("result").contains("BLOCKED:"))
            assertTrue(tool.payload.optString("result_text").contains("denied by user"))
            val cancelled = runBlocking {
                val job = async { second.waitForEvent("approval.cancelled") }
                yield()
                first.interruptSession("live-1")
                job.await()
            }
            val ids = cancelled.payload.optJSONArray("request_ids")
            assertTrue(ids != null && ids.length() == 0)
        } finally {
            first.close()
            second.close()
        }
    }

    @Test
    fun test_bug_approval_cancelled_names_request_ids() = withFake { port, http ->
        val first = HermesClient("http://127.0.0.1:$port", http)
        val second = HermesClient("http://127.0.0.1:$port", http)
        try {
            val material = runBlocking { first.login("tester", "tester") }
            val event = runBlocking {
                first.connect(material.accessToken)
                second.connect(material.accessToken)
                first.resumeSession("sess-1")
                second.resumeSession("sess-1")
                val cancelled = async { second.waitForEvent("approval.cancelled") }
                yield()
                first.interruptSession("live-1")
                cancelled.await()
            }
            val ids = event.payload.optJSONArray("request_ids")
            assertTrue(ids != null)
            val values = (0 until ids!!.length()).map { ids.optString(it) }
            assertTrue(values.contains("srq-phase0"))
            assertTrue(values.contains("req-1"))
            assertEquals("interrupted", event.payload.optString("reason"))
        } finally {
            first.close()
            second.close()
        }
    }

    @Test
    fun test_bug_login_stray_whitespace() {
        assertEquals(
            "Login failed (401: invalid_credentials)",
            httpFailureMessage("Login failed", 401, """{"detail":{"reason":"invalid_credentials"}}"""),
        )
        assertEquals(
            "Login failed (401: Invalid credentials)",
            httpFailureMessage("Login failed", 401, """{"detail":"Invalid credentials","reason":"invalid_credentials"}"""),
        )
        assertEquals(
            "Login failed (429: rate_limited)",
            httpFailureMessage("Login failed", 429, """{"reason":"rate_limited"}"""),
        )
        withFake { port, http ->
            val bodies = mutableListOf<String>()
            val types = mutableListOf<String>()
            val watching = http.newBuilder().addInterceptor { chain ->
                val request = chain.request()
                if (request.url.encodedPath == "/auth/password-login") {
                    val buffer = okio.Buffer()
                    request.body?.writeTo(buffer)
                    bodies.add(buffer.readUtf8())
                    types.add(request.body?.contentType()?.toString().orEmpty())
                }
                chain.proceed(request)
            }.build()
            val gateway = HermesClient("http://127.0.0.1:$port", watching)
            try {
                val username = " Person "
                val password = "a+b/c "
                val rejected = assertThrows<HermesException> {
                    runBlocking { gateway.login(username, password) }
                }
                assertEquals(401, rejected.status)
                assertEquals("Login failed (401: Invalid credentials)", rejected.message)
                val sent = JSONObject(bodies.first())
                assertEquals(username, sent.getString("username"))
                assertEquals(password, sent.getString("password"))
                assertEquals("basic", sent.getString("provider"))
                assertEquals("/", sent.getString("next"))
                assertTrue(bodies.first().contains("a+b/c "))
                assertTrue(!bodies.first().contains("a%2B"))
                assertTrue(types.first().startsWith("application/json"), types.first())
                assertTrue(!types.first().contains("form-urlencoded"), types.first())

                assertEquals(401, loginStatus(gateway, "Tester", "tester"))
                assertEquals(401, loginStatus(gateway, "tester ", "tester"))
                assertEquals(401, loginStatus(gateway, " tester", "tester"))
                assertEquals(401, loginStatus(gateway, "tester", "tester "))
                val material = runBlocking { gateway.login("tester", "tester") }
                assertEquals("tester", material.username)
            } finally {
                gateway.close()
            }
        }
    }
}

private fun loginStatus(gateway: HermesClient, username: String, password: String): Int? {
    val error = assertThrows<HermesException> {
        runBlocking { gateway.login(username, password) }
    }
    return error.status
}

private fun withFake(block: (Int, OkHttpClient) -> Unit) {
    val script = findFakeScript()
    val process = ProcessBuilder("python3", script.absolutePath, "--port", "0")
        .redirectErrorStream(false)
        .start()
    val http = OkHttpClient.Builder().build()
    try {
        val line = process.inputStream.bufferedReader().readLine()
            ?: error("fake server produced no output")
        val port = Regex("LISTENING (\\d+)").find(line)?.groupValues?.get(1)?.toInt()
            ?: error("unexpected fake banner: $line")
        block(port, http)
    } finally {
        process.destroy()
        process.waitFor(3, TimeUnit.SECONDS)
        http.dispatcher.executorService.shutdown()
        http.connectionPool.evictAll()
    }
}

private fun findFakeScript(): File {
    var dir = File(System.getProperty("user.dir") ?: ".")
    repeat(8) {
        val candidate = File(dir, "contract/fake/hermes_fake.py")
        if (candidate.isFile) return candidate
        dir = dir.parentFile ?: error("hermes_fake.py not found")
    }
    error("hermes_fake.py not found")
}
