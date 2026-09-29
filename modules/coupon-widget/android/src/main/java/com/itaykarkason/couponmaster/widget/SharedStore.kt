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
        urgentDaysRemaining = if (root.isNull("urgentDaysRemaining")) null else root.optInt("urgentDaysRemaining"),
        urgentCoupon = root.optJSONObject("urgentCoupon")?.let { obj ->
          WidgetCoupon(
            id = obj.optInt("id", 0),
            publicId = obj.optString("publicId", "").ifBlank { null },
            company = obj.optString("company", ""),
            code = obj.optString("code", ""),
            remainingValue = obj.optDouble("remainingValue", 0.0),
            expiration = obj.optString("expiration", "").ifBlank { null },
            logoFile = null,
            cardExp = obj.optString("cardExp", "").ifBlank { null },
            cvv = obj.optString("cvv", "").ifBlank { null },
          )
        },
        upcoming = root.optJSONArray("upcoming").toCoupons(),
        expiringCount = root.optInt("expiringCount", 0),
        expiringIds = root.optJSONArray("expiringIds")?.let { arr ->
          (0 until arr.length()).mapNotNull { arr.optString(it, "").ifBlank { null } }
        } ?: emptyList(),
        celebration = if (root.isNull("celebration")) null
        else root.optString("celebration", "").ifBlank { null },
        celebrationText = if (root.isNull("celebrationText")) null
        else root.optString("celebrationText", "").ifBlank { null },
        celebrationUntil = if (root.isNull("celebrationUntil")) null
        else root.optString("celebrationUntil", "").ifBlank { null },
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
        publicId = item.optString("publicId", "").ifBlank { null },
        company = item.optString("company", ""),
        code = item.optString("code", ""),
        remainingValue = item.optDouble("remainingValue", 0.0),
        expiration = item.optString("expiration", "").ifBlank { null },
        logoFile = item.optString("logoFile", "").ifBlank { null },
        cardExp = item.optString("cardExp", "").ifBlank { null },
        cvv = item.optString("cvv", "").ifBlank { null },
      )
    }
  }
}

data class WidgetCoupon(
  val id: Int,
  val publicId: String?,
  val company: String,
  val code: String,
  val remainingValue: Double,
  val expiration: String?,
  /**
   * Absolute path to a file the app copied into shared storage. The widget
   * cannot reach Metro-bundled assets, so it reads from disk.
   */
  val logoFile: String?,
  val cardExp: String? = null,
  val cvv: String? = null,
) {
  /**
   * Whole days from `nowMs` to expiry, 0 on the last day, null once it has
   * passed. A date-only voucher is read on the local calendar and lasts the
   * whole day. Calendar, not java.time, so it runs below API 26.
   */
  fun daysUntilExpiration(nowMs: Long): Int? {
    val raw = expiration ?: return null
    if (raw.contains("T")) {
      val at = parseIsoMillis(raw)
      if (at != null && at <= nowMs) return null
    }
    val parts = raw.take(10).split("-").mapNotNull { it.toIntOrNull() }
    if (parts.size != 3) return null
    val expiryDay = java.util.Calendar.getInstance().apply {
      clear()
      set(parts[0], parts[1] - 1, parts[2])
    }.timeInMillis
    val today = java.util.Calendar.getInstance().apply {
      timeInMillis = nowMs
      set(java.util.Calendar.HOUR_OF_DAY, 0)
      set(java.util.Calendar.MINUTE, 0)
      set(java.util.Calendar.SECOND, 0)
      set(java.util.Calendar.MILLISECOND, 0)
    }.timeInMillis
    // Rounded, so a DST day of 23 or 25 hours still counts as one.
    val days = Math.round((expiryDay - today) / 86_400_000.0).toInt()
    return if (days >= 0) days else null
  }
}

data class WidgetPayload(
  val activeCouponsCount: Int,
  val oneTimeCouponsCount: Int,
  val totalRemainingValue: Double,
  val coupons: List<WidgetCoupon>,
  val urgentDaysRemaining: Int? = null,
  val urgentCoupon: WidgetCoupon? = null,
  /**
   * Coupons expiring within the month, soonest first. The scene is derived from
   * their dates at render time, so it moves on without the app being opened.
   */
  val upcoming: List<WidgetCoupon> = emptyList(),
  val expiringCount: Int = 0,
  val expiringIds: List<String> = emptyList(),
  /** Non-null forces a celebration scene on the small widget (e.g. "anniversary"). */
  val celebration: String? = null,
  /** The celebration headline, already filled in with the user's own numbers. */
  val celebrationText: String? = null,
  /** ISO instant the celebration comes down (a redemption ends at midnight, Israel time). */
  val celebrationUntil: String? = null,
) {
  /** The celebration to draw now, or null once it has ended. */
  fun activeCelebration(nowMs: Long = System.currentTimeMillis()): String? {
    val kind = celebration ?: return null
    val end = celebrationUntil?.let(::parseIsoMillis) ?: return kind
    return if (nowMs < end) kind else null
  }

  /**
   * The soonest coupon still inside the week at `nowMs`, with its days left.
   * `urgentCoupon` covers payloads written before `upcoming` existed; the
   * picked coupons are checked too.
   */
  fun mostUrgent(nowMs: Long = System.currentTimeMillis()): Pair<WidgetCoupon, Int>? =
    (upcoming + listOfNotNull(urgentCoupon) + coupons)
      .mapNotNull { coupon -> coupon.daysUntilExpiration(nowMs)?.takeIf { it <= 7 }?.let { coupon to it } }
      .minByOrNull { it.second }

  companion object {
    val EMPTY = WidgetPayload(0, 0, 0.0, emptyList())
  }
}

/** `Date.toISOString()` output. SimpleDateFormat, not java.time, so it runs below API 26. */
private fun parseIsoMillis(raw: String): Long? {
  for (pattern in listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")) {
    try {
      val format = java.text.SimpleDateFormat(pattern, java.util.Locale.US)
      format.timeZone = java.util.TimeZone.getTimeZone("UTC")
      return format.parse(raw)?.time
    } catch (e: Exception) {
      // try the next shape
    }
  }
  return null
}
