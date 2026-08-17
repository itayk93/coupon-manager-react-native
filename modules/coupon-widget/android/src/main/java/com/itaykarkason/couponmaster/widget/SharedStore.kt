package com.itaykarkason.couponmaster.widget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Reads/writes the widget payload written by the JS layer.
 * Keep the shape in sync with `modules/coupon-widget/index.ts`.
 */
object SharedStore {
  const val PREFS_NAME = "CouponWidgetPrefs"
  const val DATA_KEY = "CouponWidgetData"

  fun write(context: Context, json: String) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(DATA_KEY, json)
      .apply()
  }

  fun readRaw(context: Context): String? =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(DATA_KEY, null)

  fun read(context: Context): WidgetPayload = parse(readRaw(context))

  fun parse(json: String?): WidgetPayload {
    if (json.isNullOrBlank()) return WidgetPayload.EMPTY
    return try {
      val root = JSONObject(json)
      WidgetPayload(
        activeCouponsCount = root.optInt("activeCouponsCount", 0),
        oneTimeCouponsCount = root.optInt("oneTimeCouponsCount", 0),
        totalRemainingValue = root.optDouble("totalRemainingValue", 0.0),
        coupons = root.optJSONArray("coupons").toCoupons(),
      )
    } catch (e: Exception) {
      WidgetPayload.EMPTY
    }
  }

  private fun JSONArray?.toCoupons(): List<WidgetCoupon> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { index ->
      val item = optJSONObject(index) ?: return@mapNotNull null
      WidgetCoupon(
        id = item.optInt("id", 0),
        company = item.optString("company", ""),
        code = item.optString("code", ""),
        remainingValue = item.optDouble("remainingValue", 0.0),
        expiration = item.optString("expiration", "").ifBlank { null },
        logoFile = item.optString("logoFile", "").ifBlank { null },
      )
    }
  }
}

data class WidgetCoupon(
  val id: Int,
  val company: String,
  val code: String,
  val remainingValue: Double,
  val expiration: String?,
  /**
   * Absolute path to a file the app copied into shared storage. The widget
   * cannot reach Metro-bundled assets, so it reads from disk.
   */
  val logoFile: String?,
)

data class WidgetPayload(
  val activeCouponsCount: Int,
  val oneTimeCouponsCount: Int,
  val totalRemainingValue: Double,
  val coupons: List<WidgetCoupon>,
) {
  companion object {
    val EMPTY = WidgetPayload(0, 0, 0.0, emptyList())
  }
}
