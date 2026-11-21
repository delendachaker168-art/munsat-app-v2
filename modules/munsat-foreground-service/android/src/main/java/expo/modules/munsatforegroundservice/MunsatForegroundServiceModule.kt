package expo.modules.munsatforegroundservice

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MunsatForegroundServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MunsatForegroundService")

    Function("start") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("React context is not available")
      val intent = Intent(context, MunsatMicForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(context, intent)
      } else {
        context.startService(intent)
      }
      true
    }

    Function("stop") {
      val context = appContext.reactContext ?: return@Function false
      context.stopService(Intent(context, MunsatMicForegroundService::class.java))
      true
    }
  }
}
