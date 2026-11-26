package com.mendroo.provider

import android.graphics.Color
import android.os.Build
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SystemNavBarModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SystemNavBar"

  @ReactMethod
  fun setNavigationBarStyle(hexColor: String, isDarkContent: Boolean) {
    val activity = currentActivity ?: return
    activity.runOnUiThread {
      try {
        val window = activity.window
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          window.navigationBarColor = Color.parseColor(hexColor)
        }
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightNavigationBars = isDarkContent
      } catch (_: Exception) {
        // Ignore invalid color or detached window
      }
    }
  }
}
