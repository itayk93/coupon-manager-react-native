import ExpoModulesCore
import WidgetKit

/// Keep in sync with `targets/widget/SharedStore.swift` and the Android module.
public let couponWidgetAppGroup = "group.com.itaykarkason.couponmaster"
public let couponWidgetDataKey = "CouponWidgetData"

/// Written by the share extension, read once by the app.
/// Keep in sync with `targets/share/ShareViewController.swift`.
public let couponSharedImageName = "shared-usage-screenshot.jpg"
public let couponSharedTextName = "shared-coupon-text.txt"
public let couponSharedImportName = "shared-usage-import.json"

public class CouponWidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CouponWidget")

    Function("setWidgetData") { (json: String) in
      guard let defaults = UserDefaults(suiteName: couponWidgetAppGroup) else { return }
      defaults.set(json, forKey: couponWidgetDataKey)
      defaults.synchronize()
    }

    Function("getWidgetData") { () -> String? in
      UserDefaults(suiteName: couponWidgetAppGroup)?.string(forKey: couponWidgetDataKey)
    }

    /// Directory both the app and the widget can read. The app copies company
    /// logos here because the widget cannot reach Metro-bundled JS assets.
    Function("getSharedDirectory") { () -> String? in
      guard let container = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: couponWidgetAppGroup)
      else { return nil }

      let logos = container.appendingPathComponent("logos", isDirectory: true)
      try? FileManager.default.createDirectory(at: logos, withIntermediateDirectories: true)
      return logos.path
    }

    /// Returns the pending import without deleting it. The image is acknowledged
    /// only after a successful batch save or an explicit user cancellation.
    Function("peekSharedImport") { () -> String? in
      guard let container = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: couponWidgetAppGroup)
      else { return nil }

      let imageFile = container.appendingPathComponent(couponSharedImageName)
      let textFile = container.appendingPathComponent(couponSharedTextName)
      let jobFile = container.appendingPathComponent(couponSharedImportName)
      guard let jobData = try? Data(contentsOf: jobFile),
            var job = try? JSONSerialization.jsonObject(with: jobData) as? [String: Any]
      else { return nil }
      if let imageData = try? Data(contentsOf: imageFile) {
        job["imageBase64"] = imageData.base64EncodedString()
      } else if let text = try? String(contentsOf: textFile, encoding: .utf8), !text.isEmpty {
        job["text"] = text
      } else {
        return nil
      }
      guard let payload = try? JSONSerialization.data(withJSONObject: job) else { return nil }
      return String(data: payload, encoding: .utf8)
    }

    Function("completeSharedImport") { () in
      guard let container = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: couponWidgetAppGroup)
      else { return }
      try? FileManager.default.removeItem(at: container.appendingPathComponent(couponSharedImageName))
      try? FileManager.default.removeItem(at: container.appendingPathComponent(couponSharedTextName))
      try? FileManager.default.removeItem(at: container.appendingPathComponent(couponSharedImportName))
    }

    Function("reloadWidgets") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
