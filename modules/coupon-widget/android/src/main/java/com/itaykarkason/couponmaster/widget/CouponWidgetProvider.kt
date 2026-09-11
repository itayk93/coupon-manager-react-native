package com.itaykarkason.couponmaster.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews

/**
 * A single resizable widget that mirrors the three iOS layouts:
 * small -> stats, medium -> two coupon cards, large -> header + full list.
 */
class CouponWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { render(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    manager: AppWidgetManager,
    id: Int,
    newOptions: Bundle,
  ) {
    render(context, manager, id)
  }

  private fun render(context: Context, manager: AppWidgetManager, id: Int) {
    val payload = SharedStore.read(context)
    val options = manager.getAppWidgetOptions(id)
    val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)

    // Logos are local files the app copied across, so a single pass is enough.
    val logos = payload.coupons
      .mapNotNull { coupon -> coupon.logoFile?.let { coupon.id to loadCircularBitmap(it) } }
      .toMap()

    manager.updateAppWidget(id, buildViews(context, payload, width, height, logos))
  }

  // ---------------------------------------------------------------- layouts

  private fun buildViews(
    context: Context,
    payload: WidgetPayload,
    width: Int,
    height: Int,
    logos: Map<Int, Bitmap?>,
  ): RemoteViews = when {
    width < MEDIUM_MIN_WIDTH_DP && height < LARGE_MIN_HEIGHT_DP -> smallViews(context, payload)
    height < LARGE_MIN_HEIGHT_DP -> listViews(context, payload, logos, limit = 2, showHeader = false)
    else -> listViews(context, payload, logos, limit = MAX_CARDS, showHeader = true)
  }

  private fun smallViews(context: Context, payload: WidgetPayload): RemoteViews {
    payload.activeCelebration()?.let { return celebrationViews(context, it, payload.celebrationText) }
    val days = payload.urgentDaysRemaining
    return if (days != null && days in 0..7) {
      mascotViews(context, payload.expiringIds, days, payload.urgentCoupon)
    } else {
      statsViews(context, payload)
    }
  }

  /** A milestone scene forced onto the small widget. Opens the app on tap. */
  private fun celebrationViews(context: Context, kind: String, text: String?): RemoteViews =
    RemoteViews(context.packageName, R.layout.coupon_widget_mascot).apply {
      val sceneRes = when (kind) {
        "redeemed" -> R.drawable.celebration_c3
        "anniversary" -> R.drawable.celebration_c1
        "milestone" -> R.drawable.celebration_c2
        "savings" -> R.drawable.celebration_c3
        "monthly" -> R.drawable.celebration_c4
        "streak" -> R.drawable.celebration_c5
        "rescue" -> R.drawable.celebration_c6
        "clean" -> R.drawable.celebration_c7
        "referral" -> R.drawable.celebration_c8
        "record" -> R.drawable.celebration_c9
        else -> R.drawable.celebration_c1
      }
      val title = when (kind) {
        "redeemed" -> "מימשת קופון!"
        "anniversary" -> "שנה איתנו!"
        "milestone" -> "אבן דרך חדשה!"
        "savings" -> "כמה שחסכת!"
        "monthly" -> "החיסכון החודשי שלך"
        "streak" -> "רצף מנצח!"
        "rescue" -> "הצלה ברגע האחרון!"
        "clean" -> "חודש נקי!"
        "referral" -> "חבר הצטרף!"
        "record" -> "שיא חדש בארנק!"
        else -> "מזל טוב!"
      }
      setImageViewResource(R.id.mascot_image, sceneRes)
      setViewVisibility(R.id.mascot_today_logo, View.VISIBLE)
      setViewVisibility(R.id.mascot_today_title, View.VISIBLE)
      // The app fills the headline in with real numbers; `title` is only a
      // fallback for a payload written by an older build.
      setTextViewText(R.id.mascot_today_title, text?.takeIf { it.isNotBlank() } ?: title)
      setViewVisibility(R.id.mascot_company, View.GONE)
      // Money milestones open the statistics screen, where that number is broken down.
      val target = when (kind) {
        "redeemed", "rescue", "savings", "monthly", "record", "milestone" -> "couponmaster:///statistics"
        "referral" -> "couponmaster:///referral-program"
        else -> "couponmaster:///"
      }
      setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, target))
    }

  /** Image-only: the scene illustration for `days` carries its own headline.
   *  Tapping opens the coupons list filtered to exactly the expiring ids. */
  private fun mascotViews(
    context: Context,
    expiringIds: List<String>,
    days: Int,
    coupon: WidgetCoupon?,
  ): RemoteViews = RemoteViews(context.packageName, R.layout.coupon_widget_mascot).apply {
    val sceneRes = when (days.coerceIn(0, 7)) {
      0 -> R.drawable.mascot_scene_0
      1 -> R.drawable.mascot_scene_1
      2 -> R.drawable.mascot_scene_2
      3 -> R.drawable.mascot_scene_3
      4 -> R.drawable.mascot_scene_4
      5 -> R.drawable.mascot_scene_5
      6 -> R.drawable.mascot_scene_6
      else -> R.drawable.mascot_scene_7
    }
    setImageViewResource(R.id.mascot_image, sceneRes)
    val isExpiring = days in 0..7
    val titleText = when {
      days <= 0 -> "בתוקף עד היום"
      days == 1 -> "בתוקף עד מחר"
      days == 2 -> "בתוקף עוד יומיים"
      days in 3..7 -> "בתוקף עוד $days ימים"
      else -> "בתוקף עוד שבוע"
    }
    setViewVisibility(R.id.mascot_today_title, if (isExpiring) View.VISIBLE else View.GONE)
    setViewVisibility(R.id.mascot_today_logo, if (isExpiring) View.VISIBLE else View.GONE)
    if (isExpiring) {
      setTextViewText(R.id.mascot_today_title, titleText)
    }
    val companyName = coupon?.company?.trim().orEmpty()
    val amount = java.text.NumberFormat.getNumberInstance(java.util.Locale.US).apply {
      maximumFractionDigits = 2
    }.format(coupon?.remainingValue ?: 0.0)
    setTextViewText(R.id.mascot_company, "$companyName · יתרה \u2066₪$amount\u2069")
    setViewVisibility(R.id.mascot_company, if (isExpiring && companyName.isNotEmpty()) View.VISIBLE else View.GONE)
    val target = if (isExpiring && coupon != null) {
      "couponmaster:///coupons/${coupon.publicId ?: coupon.id}"
    } else if (expiringIds.isNotEmpty()) {
      "couponmaster:///coupons?ids=${expiringIds.joinToString(",")}"
    } else {
      "couponmaster:///coupons"
    }
    setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, target))
  }

  private fun statsViews(context: Context, payload: WidgetPayload): RemoteViews =
    RemoteViews(context.packageName, R.layout.coupon_widget_stats).apply {
      setTextViewText(R.id.one_time_value, payload.oneTimeCouponsCount.toString())
      setTextViewText(R.id.active_value, payload.activeCouponsCount.toString())
      setTextViewText(R.id.total_value, formatShekels(payload.totalRemainingValue))
      setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, "couponmaster:///"))
    }

  private fun listViews(
    context: Context,
    payload: WidgetPayload,
    logos: Map<Int, Bitmap?>,
    limit: Int,
    showHeader: Boolean,
  ): RemoteViews = RemoteViews(context.packageName, R.layout.coupon_widget_list).apply {
    setViewVisibility(R.id.header, if (showHeader) View.VISIBLE else View.GONE)
    setViewVisibility(R.id.header_divider, if (showHeader) View.VISIBLE else View.GONE)
    setTextViewText(R.id.header_active, "קופונים פעילים: ${payload.activeCouponsCount}")
    setTextViewText(R.id.header_balance, "יתרה: " + formatShekels(payload.totalRemainingValue))
    setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, "couponmaster:///"))

    val coupons = payload.coupons.take(limit)
    setViewVisibility(R.id.empty_state, if (coupons.isEmpty()) View.VISIBLE else View.GONE)
    setTextViewText(
      R.id.empty_state,
      if (limit == 2) "בחר עד 2 קופונים" else "אין קופונים פעילים",
    )

    CARD_IDS.forEachIndexed { index, cardId ->
      val coupon = coupons.getOrNull(index)
      if (coupon == null) {
        setViewVisibility(cardId.root, View.GONE)
        return@forEachIndexed
      }

      val extraDetails = buildList {
        coupon.cardExp?.takeIf { it.isNotBlank() }?.let { add("תוקף: $it") }
        coupon.cvv?.takeIf { it.isNotBlank() }?.let { add("CVV: $it") }
      }.joinToString(" • ")

      val balanceText = if (extraDetails.isNotBlank()) {
        "יתרה: ${formatShekels(coupon.remainingValue)} | $extraDetails"
      } else {
        "יתרה: " + formatShekels(coupon.remainingValue)
      }
      setTextViewText(cardId.balance, balanceText)
      setTextViewText(cardId.code, formatCouponCode(coupon.code))

      val logo = logos[coupon.id]
      if (logo != null) {
        setImageViewBitmap(cardId.logo, logo)
        setViewVisibility(cardId.logo, View.VISIBLE)
        setViewVisibility(cardId.initials, View.GONE)
      } else {
        setTextViewText(cardId.initials, coupon.company.take(2).uppercase())
        setViewVisibility(cardId.logo, View.GONE)
        setViewVisibility(cardId.initials, View.VISIBLE)
      }

      setOnClickPendingIntent(
        cardId.root,
        openAppIntent(context, "couponmaster:///coupons/${coupon.publicId ?: coupon.id}"),
      )
    }
  }

  // ---------------------------------------------------------------- helpers

  private fun openAppIntent(context: Context, deepLink: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
      setPackage(context.packageName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    return PendingIntent.getActivity(
      context,
      deepLink.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun loadCircularBitmap(path: String): Bitmap? = try {
    BitmapFactory.decodeFile(path)?.let(::circleCrop)
  } catch (e: Exception) {
    null
  }

  private fun circleCrop(source: Bitmap): Bitmap {
    val size = minOf(source.width, source.height)
    val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val rect = Rect(0, 0, size, size)

    canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
    paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
    val srcLeft = (source.width - size) / 2
    val srcTop = (source.height - size) / 2
    canvas.drawBitmap(source, Rect(srcLeft, srcTop, srcLeft + size, srcTop + size), rect, paint)
    return output
  }

  private data class CardIds(
    val root: Int,
    val logo: Int,
    val initials: Int,
    val company: Int,
    val balance: Int,
    val code: Int,
  )

  companion object {
    /** Below these the widget is treated as an iOS "small"/"medium" tile. */
    private const val MEDIUM_MIN_WIDTH_DP = 200
    private const val LARGE_MIN_HEIGHT_DP = 250

    const val MAX_CARDS = 4

    private val CARD_IDS = listOf(
      CardIds(R.id.card_1, R.id.logo_1, R.id.initials_1, R.id.company_1, R.id.balance_1, R.id.code_1),
      CardIds(R.id.card_2, R.id.logo_2, R.id.initials_2, R.id.company_2, R.id.balance_2, R.id.code_2),
      CardIds(R.id.card_3, R.id.logo_3, R.id.initials_3, R.id.company_3, R.id.balance_3, R.id.code_3),
      CardIds(R.id.card_4, R.id.logo_4, R.id.initials_4, R.id.company_4, R.id.balance_4, R.id.code_4),
    )

    /**
     * Formats an amount with the shekel sign visually left of the digits.
     * The widget drops the agorot because the tile is small.
     */
    fun formatShekels(value: Double): String =
      String.format(java.util.Locale.US, "₪ %,d", Math.round(value))

    /**
     * Wraps a coupon code onto at most 4 balanced lines.
     *
     * The original broke every 10 characters, which left a 12-character code
     * as 10 + 2 and read as truncated. Even chunks keep the block rectangular
     * at any length. Must stay in sync with the iOS version.
     */
    fun formatCouponCode(code: String): String {
      if (code.length <= 10) return code
      val lineCount = minOf(4, Math.ceil(code.length / 10.0).toInt())
      val perLine = Math.ceil(code.length.toDouble() / lineCount).toInt()
      return code.chunked(perLine).joinToString("\n")
    }

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(
        android.content.ComponentName(context, CouponWidgetProvider::class.java)
      )
      if (ids.isEmpty()) return
      context.sendBroadcast(
        Intent(context, CouponWidgetProvider::class.java).apply {
          action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
      )
    }
  }
}
