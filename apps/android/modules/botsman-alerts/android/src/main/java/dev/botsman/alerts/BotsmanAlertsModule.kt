package dev.botsman.alerts

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The native side of alerts. It will hold the foreground service that keeps the alerts connection open.
class BotsmanAlertsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BotsmanAlerts")

    // Describes the device, which proves the Kotlin module is linked and callable.
    Function("deviceSummary") {
      "${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}"
    }
  }
}
