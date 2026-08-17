package com.itaykarkason.couponmaster.widget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CouponWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CouponWidget")

    Function("setWidgetData") { json: String ->
      SharedStore.write(appContext.reactContext!!, json)
    }

    Function("getWidgetData") {
      SharedStore.readRaw(appContext.reactContext!!)
    }

    /**
     * Directory both the app and the widget can read. The app copies company
     * logos here because the widget cannot reach Metro-bundled JS assets.
     * On Android the widget runs in the same package, so app storage is enough.
     */
    Function("getSharedDirectory") {
      appContext.reactContext?.let { context ->
        java.io.File(context.filesDir, "widget-logos").apply { mkdirs() }.absolutePath
      }
    }

    Function("reloadWidgets") {
      appContext.reactContext?.let { CouponWidgetProvider.refreshAll(it) }
    }
  }
}
