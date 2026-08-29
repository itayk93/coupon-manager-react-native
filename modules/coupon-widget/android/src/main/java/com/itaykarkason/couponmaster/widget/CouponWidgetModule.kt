package com.itaykarkason.couponmaster.widget

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
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
      val cachedJob = File(context.filesDir, "shared-usage-import.json")
      if (cachedImage.exists() && cachedJob.exists()) {
        val job = JSONObject(cachedJob.readText())
        job.put("imageBase64", Base64.encodeToString(cachedImage.readBytes(), Base64.NO_WRAP))
        return@Function job.toString()
      }

      val activity = appContext.currentActivity
      val intent = activity?.intent
      val uri: Uri? = when {
        intent == null -> null
        intent.action != Intent.ACTION_SEND -> null
        intent.type?.startsWith("image/") != true -> null
        else -> extraStream(intent)
      }

      if (uri == null) return@Function null
      val image = readScaledImage(activity!!, uri) ?: return@Function null
      val bytes = Base64.decode(image, Base64.NO_WRAP)
      cachedImage.writeBytes(bytes)
      val job = JSONObject()
        .put("id", UUID.randomUUID().toString())
        .put("createdAt", Instant.now().toString())
        .put("state", "pending")
      cachedJob.writeText(job.toString())
      intent!!.action = null
      intent.removeExtra(Intent.EXTRA_STREAM)
      job.put("imageBase64", image).toString()
    }

    Function("completeSharedImport") {
      val context = appContext.reactContext ?: return@Function false
      File(context.filesDir, "shared-usage-screenshot.jpg").delete()
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
