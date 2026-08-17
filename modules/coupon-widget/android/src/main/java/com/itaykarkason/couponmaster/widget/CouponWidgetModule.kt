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

    Function("reloadWidgets") {
      appContext.reactContext?.let { CouponWidgetProvider.refreshAll(it) }
    }
  }
}
