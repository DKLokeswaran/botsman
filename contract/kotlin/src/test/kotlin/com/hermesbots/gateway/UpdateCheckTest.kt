package com.hermesbots.gateway

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class UpdateCheckTest {
    private val sample = """
        {"version":"0.1.0","build":42,"sha":"1516bc1",
         "windows":{"url":"http://100.113.35.96:8711/setup.exe","sha256":"abc","size":10},
         "android":{"url":"http://100.113.35.96:8711/app-debug.apk","sha256":"def","size":20,"versionCode":42}}
    """.trimIndent()

    @Test
    fun versionLabelNamesTheBuildAndTheShortSha() {
        assertEquals("0.1.0 (build 42, 1516bc1)", formatAppVersion("0.1.0", "42", "1516bc1"))
        assertEquals("0.1.0 (build dev, dev)", formatAppVersion("0.1.0", "dev", "dev"))
    }

    @Test
    fun latestJsonParsesAndAHigherBuildIsAnUpdate() {
        val latest = parseLatest(sample)
        assertEquals("0.1.0", latest?.version)
        assertEquals(42, latest?.build)
        assertEquals(42, latest?.android?.versionCode)
        assertEquals(10L, latest?.windows?.size)
        assertTrue(updateAvailable("41", latest!!.build))
        assertFalse(updateAvailable("42", latest.build))
        assertFalse(updateAvailable("43", latest.build))
        assertTrue(updateAvailable("dev", latest.build))
        assertFalse(updateAvailable("dev", 0))
        assertNull(parseLatest("not json"))
        assertNull(parseLatest("""{"version":"0.1.0","build":1,"sha":"abc"}"""))
    }
}
