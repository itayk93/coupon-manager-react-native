import ExpoModulesCore
import WidgetKit

/// Keep in sync with `targets/widget/SharedStore.swift` and the Android module.
public let couponWidgetAppGroup = "group.com.itaykarkason.couponmaster"
public let couponWidgetDataKey = "CouponWidgetData"

/// Written by the share extension, read once by the app.
/// Keep in sync with `targets/share/ShareViewController.swift`.
public let couponSharedImageName = "shared-usage-screenshot.jpg"

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

    /// Hands over the screenshot the share extension left behind, if any, and
    /// clears it so the same image is never imported twice.
    Function("consumeSharedImage") { () -> String? in
      guard let container = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: couponWidgetAppGroup)
      else { return nil }

      let file = container.appendingPathComponent(couponSharedImageName)
      guard let data = try? Data(contentsOf: file) else { return nil }
      try? FileManager.default.removeItem(at: file)
      return data.base64EncodedString()
    }

    Function("reloadWidgets") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
