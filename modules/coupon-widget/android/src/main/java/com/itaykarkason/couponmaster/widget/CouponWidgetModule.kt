package com.itaykarkason.couponmaster.widget

import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant
import java.util.UUID
import org.json.JSONObject

/**
 * Screenshots arrive at full screen resolution and the app base64-encodes them
 * into an edge function request, so cap the long edge before uploading.
 * Keep in sync with `targets/share/ShareViewController.swift`.
 */
private const val MAX_DIMENSION = 1600

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

    Function("peekSharedImport") {
      val context = appContext.reactContext ?: return@Function null
      val cachedImage = File(context.filesDir, "shared-usage-screenshot.jpg")
      val cachedText = File(context.filesDir, "shared-coupon-text.txt")
      val cachedJob = File(context.filesDir, "shared-usage-import.json")
      if (cachedJob.exists() && (cachedImage.exists() || cachedText.exists())) {
        val job = JSONObject(cachedJob.readText())
        if (cachedImage.exists()) {
          job.put("imageBase64", Base64.encodeToString(cachedImage.readBytes(), Base64.NO_WRAP))
        } else {
          job.put("text", cachedText.readText())
        }
        return@Function job.toString()
      }

      val activity = appContext.currentActivity
      val intent = activity?.intent
      if (intent == null || intent.action != Intent.ACTION_SEND) return@Function null
      val currentActivity = activity ?: return@Function null
      val currentIntent = intent ?: return@Function null
      val mode = shareMode(currentActivity, currentIntent)
      val mimeType = currentIntent.type.orEmpty().lowercase()
      val uri = extraStream(currentIntent)
      val image = when {
        uri == null -> null
        mimeType == "application/pdf" -> readFirstPdfPage(currentActivity, uri)
        else -> readScaledImage(currentActivity, uri)
      }
      val sharedText = currentIntent.getCharSequenceExtra(Intent.EXTRA_TEXT)
        ?.toString()
        ?.trim()
        ?.takeIf { it.isNotEmpty() }

      if (image == null && sharedText == null) return@Function null
      if (image != null) {
        cachedText.delete()
        cachedImage.writeBytes(Base64.decode(image, Base64.NO_WRAP))
      } else {
        cachedImage.delete()
        cachedText.writeText(sharedText!!)
      }
      val job = JSONObject()
        .put("id", UUID.randomUUID().toString())
        .put("createdAt", Instant.now().toString())
        .put("mode", mode)
        .put("state", "pending")
      cachedJob.writeText(job.toString())
      currentIntent.action = null
      currentIntent.removeExtra(Intent.EXTRA_STREAM)
      currentIntent.removeExtra(Intent.EXTRA_TEXT)
      if (image != null) job.put("imageBase64", image) else job.put("text", sharedText)
      job.toString()
    }

    Function("completeSharedImport") {
      val context = appContext.reactContext ?: return@Function false
      File(context.filesDir, "shared-usage-screenshot.jpg").delete()
      File(context.filesDir, "shared-coupon-text.txt").delete()
      File(context.filesDir, "shared-usage-import.json").delete()
      true
    }

    Function("reloadWidgets") {
      appContext.reactContext?.let { CouponWidgetProvider.refreshAll(it) }
    }
  }
}

@Suppress("DEPRECATION")
private fun extraStream(intent: Intent): Uri? =
  if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
  } else {
    intent.getParcelableExtra(Intent.EXTRA_STREAM)
  }

private fun readScaledImage(context: android.content.Context, uri: Uri): String? {
  val resolver = context.contentResolver

  val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null

  val longest = maxOf(bounds.outWidth, bounds.outHeight)
  if (longest <= 0) return null

  // Power-of-two subsampling is what BitmapFactory supports, and it decodes the
  // smaller image directly rather than allocating the full-size one first.
  var sample = 1
  while (longest / sample > MAX_DIMENSION) sample *= 2

  val options = BitmapFactory.Options().apply { inSampleSize = sample }
  val bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
    ?: return null

  return ByteArrayOutputStream().use { out ->
    bitmap.compress(Bitmap.CompressFormat.JPEG, 70, out)
    bitmap.recycle()
    Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  }
}

private fun readFirstPdfPage(context: android.content.Context, uri: Uri): String? {
  val descriptor = context.contentResolver.openFileDescriptor(uri, "r") ?: return null
  return descriptor.use { fileDescriptor ->
    PdfRenderer(fileDescriptor).use rendererUse@ { renderer ->
      if (renderer.pageCount == 0) return@rendererUse null
      renderer.openPage(0).use { page ->
        val longest = maxOf(page.width, page.height).coerceAtLeast(1)
        val scale = minOf(1f, MAX_DIMENSION.toFloat() / longest)
        val width = (page.width * scale).toInt().coerceAtLeast(1)
        val height = (page.height * scale).toInt().coerceAtLeast(1)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.WHITE)
        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
        ByteArrayOutputStream().use { out ->
          bitmap.compress(Bitmap.CompressFormat.JPEG, 82, out)
          bitmap.recycle()
          Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        }
      }
    }
  }
}

private fun shareMode(context: android.content.Context, intent: Intent): String {
  val component = intent.component
  val className = component?.className.orEmpty()
  if (className.endsWith(".CouponAddShareActivity")) return "add"
  if (className.endsWith(".CouponUsageShareActivity")) return "usage"

  if (component != null) {
    val metadata = try {
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
        context.packageManager.getActivityInfo(
          component,
          PackageManager.ComponentInfoFlags.of(PackageManager.GET_META_DATA.toLong())
        ).metaData
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getActivityInfo(component, PackageManager.GET_META_DATA).metaData
      }
    } catch (_: Exception) {
      null
    }
    when (metadata?.getString("com.itaykarkason.couponmaster.SHARE_MODE")) {
      "add" -> return "add"
      "usage" -> return "usage"
    }
  }

  return "choose"
}
