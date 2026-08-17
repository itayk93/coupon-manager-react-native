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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.URL

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

    // Logos come off the network, so draw once without them and again once loaded.
    manager.updateAppWidget(id, buildViews(context, payload, width, height, emptyMap()))

    val urls = payload.coupons.mapNotNull { it.logoUrl }
    if (urls.isEmpty()) return

    CoroutineScope(Dispatchers.IO).launch {
      val logos = payload.coupons
        .mapNotNull { coupon -> coupon.logoUrl?.let { coupon.id to loadCircularBitmap(it) } }
        .toMap()
      manager.updateAppWidget(id, buildViews(context, payload, width, height, logos))
    }
  }

  // ---------------------------------------------------------------- layouts

  private fun buildViews(
    context: Context,
    payload: WidgetPayload,
    width: Int,
    height: Int,
    logos: Map<Int, Bitmap?>,
  ): RemoteViews = when {
    width < MEDIUM_MIN_WIDTH_DP && height < LARGE_MIN_HEIGHT_DP -> statsViews(context, payload)
    height < LARGE_MIN_HEIGHT_DP -> listViews(context, payload, logos, limit = 2, showHeader = false)
    else -> listViews(context, payload, logos, limit = MAX_CARDS, showHeader = true)
  }

  private fun statsViews(context: Context, payload: WidgetPayload): RemoteViews =
    RemoteViews(context.packageName, R.layout.coupon_widget_stats).apply {
      setTextViewText(R.id.one_time_value, payload.oneTimeCouponsCount.toString())
      setTextViewText(R.id.active_value, payload.activeCouponsCount.toString())
      setTextViewText(R.id.total_value, "₪${payload.totalRemainingValue.toInt()}")
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
    setTextViewText(R.id.header_balance, "יתרה: ₪${payload.totalRemainingValue.toInt()}")
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

      setViewVisibility(cardId.root, View.VISIBLE)
      setTextViewText(cardId.company, coupon.company)
      setTextViewText(cardId.balance, "יתרה: ${coupon.remainingValue.toInt()}₪")
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
        openAppIntent(context, "couponmaster:///coupons/${coupon.id}"),
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

  private fun loadCircularBitmap(url: String): Bitmap? = try {
    URL(url).openStream().use { BitmapFactory.decodeStream(it) }?.let(::circleCrop)
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

    /** Matches the iOS `formatCouponCode` — a line break every 10 characters. */
    fun formatCouponCode(code: String): String = code.chunked(10).joinToString("\n")

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
