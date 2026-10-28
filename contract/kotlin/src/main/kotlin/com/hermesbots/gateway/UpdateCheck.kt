package com.hermesbots.gateway

import org.json.JSONObject

data class ReleaseFile(
    val url: String,
    val sha256: String,
    val size: Long,
    val versionCode: Int?,
)

data class LatestRelease(
    val version: String,
    val build: Int,
    val sha: String,
    val windows: ReleaseFile,
    val android: ReleaseFile,
)

fun formatAppVersion(name: String, build: String, sha: String): String = "$name (build $build, $sha)"

fun parseLatest(raw: String): LatestRelease? {
    val root = try {
        JSONObject(raw)
    } catch (_: Exception) {
        return null
    }
    val version = root.optString("version")
    val sha = root.optString("sha")
    val build = if (root.has("build") && !root.isNull("build")) root.optInt("build", -1) else -1
    val windows = file(root.optJSONObject("windows"), requireCode = false)
    val android = file(root.optJSONObject("android"), requireCode = true)
    if (version.isEmpty() || sha.isEmpty() || build < 0 || windows == null || android == null) {
        return null
    }
    return LatestRelease(version, build, sha, windows, android)
}

fun updateAvailable(localBuild: String, remoteBuild: Int): Boolean {
    if (remoteBuild < 0) return false
    if (localBuild.isNotEmpty() && localBuild.all { it.isDigit() }) {
        return remoteBuild > localBuild.toInt()
    }
    return remoteBuild > 0
}

private fun file(obj: JSONObject?, requireCode: Boolean): ReleaseFile? {
    if (obj == null) return null
    val url = obj.optString("url")
    val sha256 = obj.optString("sha256")
    if (url.isEmpty() || sha256.isEmpty() || !obj.has("size") || obj.isNull("size")) return null
    val size = obj.optLong("size", -1)
    if (size < 0) return null
    val versionCode = if (obj.has("versionCode") && !obj.isNull("versionCode")) obj.optInt("versionCode") else null
    if (requireCode && versionCode == null) return null
    return ReleaseFile(url, sha256, size, versionCode)
}
