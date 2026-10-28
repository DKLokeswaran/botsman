package com.hermesbots.phase0

import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

object UpdateDownload {
    private val inFlight = AtomicBoolean(false)

    fun tryBeginDownload(): Boolean = inFlight.compareAndSet(false, true)

    fun endDownload() {
        inFlight.set(false)
    }

    fun apkStem(build: Int): String = "hermes-bots-update-$build-${System.nanoTime() % 1_000_000_000}"

    fun isUpdateLeftover(name: String): Boolean {
        if (name == "hermes-bots-update.apk") return true
        return name.startsWith("hermes-bots-update-") && (name.endsWith(".apk") || name.endsWith(".part"))
    }

    fun pruneLeftovers(dir: File, keep: File) {
        val entries = dir.listFiles() ?: return
        for (file in entries) {
            if (file == keep) continue
            val name = file.name
            if (isUpdateLeftover(name)) {
                file.delete()
            }
        }
    }

    fun formatProgress(received: Long, total: Long?): String {
        fun mb(bytes: Long) = "%.1f".format(bytes.toDouble() / (1024.0 * 1024.0))
        if (total != null && total > 0) {
            val percent = ((received.toDouble() / total.toDouble()) * 100.0).toInt().coerceAtMost(100)
            return "Downloading $percent% (${mb(received)} / ${mb(total)} MB)"
        }
        return "Downloading ${mb(received)} MB"
    }
}
