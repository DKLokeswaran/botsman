package com.hermesbots.phase0

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class Phase0UpdateTest {
    @Test
    fun test_bug_update_locked_old_temp_does_not_block() {
        val dir = File.createTempFile("hermes-update-test", "").apply {
            delete()
            mkdirs()
        }
        try {
            val legacy = File(dir, "hermes-bots-update.apk")
            legacy.outputStream().use { it.write("hold".toByteArray()) }
            val keep = File(dir, "${UpdateDownload.apkStem(29)}.part")
            UpdateDownload.pruneLeftovers(dir, keep)
            assertTrue(legacy.exists())
            val first = File(dir, "${UpdateDownload.apkStem(29)}.apk")
            val second = File(dir, "${UpdateDownload.apkStem(29)}.apk")
            assertNotEquals(first.name, second.name)
            assertTrue(UpdateDownload.isUpdateLeftover("hermes-bots-update.apk"))
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun test_bug_update_single_flight_and_progress() {
        assertTrue(UpdateDownload.tryBeginDownload())
        assertFalse(UpdateDownload.tryBeginDownload())
        UpdateDownload.endDownload()
        assertTrue(UpdateDownload.tryBeginDownload())
        UpdateDownload.endDownload()
        assertEquals(
            "Downloading 50% (1.0 / 2.0 MB)",
            UpdateDownload.formatProgress(1_048_576, 2_097_152),
        )
    }
}
