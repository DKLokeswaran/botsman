package com.hermesbots.gateway

import java.io.File
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
            assertThrows<HermesException> {
                runBlocking { gateway.login("tester", "nope") }
            }
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
            val socket = http.newWebSocket(
                okhttp3.Request.Builder().url("ws://127.0.0.1:$port/api/ws?ticket=$ticket").build(),
                object : okhttp3.WebSocketListener() {},
            )
            socket.close(1000, "done")
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
            assertThrows<HermesException> {
                runBlocking { gateway.refresh(material) }
            }
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
                assertEquals("live-1", opened.first)
                assertEquals("Say hello", opened.second.first().text)
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
