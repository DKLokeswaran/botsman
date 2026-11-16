package dev.botsman.updates

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller

// Hears back from Android's installer. When the installer wants the owner's confirmation, this shows its dialog.
class InstallStatusReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    if (status != PackageInstaller.STATUS_PENDING_USER_ACTION) return
    @Suppress("DEPRECATION")
    val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
    context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
