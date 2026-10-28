package com.hermesbots.phase0

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File

/** Hands a verified APK to the system installer. Returns a message when Android blocked the install. */
fun installDownloadedApk(activity: Activity, file: File): String? {
    if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
        val settings = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${activity.packageName}"),
        )
        activity.startActivity(settings)
        return "Android is blocking installs from Hermes Bots. Allow them in the system screen, then tap Update again."
    }
    val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
    val view = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    activity.startActivity(view)
    return null
}
