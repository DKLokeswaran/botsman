package dev.botsman.updates

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

// Updates the app from a build the owner chose to install: download it, check it is the released file, and
// hand it to Android's installer. Android itself refuses a build signed with a different key.
class BotsmanUpdatesModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BotsmanUpdates")

    Function("installedVersion") {
      context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: ""
    }

    // Whether the owner has allowed this app to install other builds of itself.
    Function("canInstall") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()
    }

    // Opens the Android setting where the owner allows installs from this app.
    Function("openInstallSettings") {
      val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("downloadAndInstall") { url: String, sha256: String ->
      val apk = File(context.cacheDir, "botsman-update.apk")
      val digest = download(url, apk)
      if (!digest.equals(sha256, ignoreCase = true)) {
        apk.delete()
        throw CodedException("ERR_UPDATE_DIGEST", "The download doesn't match the release. Nothing was installed.", null)
      }
      install(apk)
    }
  }

  // Saves the file and returns its SHA-256 digest, computed while it downloads.
  private fun download(url: String, target: File): String {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.connectTimeout = 15_000
    connection.readTimeout = 30_000
    try {
      if (connection.responseCode != HttpURLConnection.HTTP_OK) {
        throw CodedException("ERR_UPDATE_DOWNLOAD", "The download failed with status ${connection.responseCode}.", null)
      }
      val digest = MessageDigest.getInstance("SHA-256")
      connection.inputStream.use { input ->
        target.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
            output.write(buffer, 0, read)
          }
        }
      }
      return digest.digest().joinToString("") { "%02x".format(it) }
    } finally {
      connection.disconnect()
    }
  }

  // Gives the file to Android's installer, which asks the owner to confirm.
  private fun install(apk: File) {
    val installer = context.packageManager.packageInstaller
    val sessionId = installer.createSession(PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL))
    installer.openSession(sessionId).use { session ->
      session.openWrite("botsman.apk", 0, apk.length()).use { output ->
        apk.inputStream().use { input -> input.copyTo(output) }
        session.fsync(output)
      }
      val status = Intent(context, InstallStatusReceiver::class.java)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
      session.commit(PendingIntent.getBroadcast(context, sessionId, status, flags).intentSender)
    }
  }
}
