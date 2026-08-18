import ExpoModulesCore
import WidgetKit

/// Keep in sync with `targets/widget/SharedStore.swift` and the Android module.
public let couponWidgetAppGroup = "group.com.itaykarkason.couponmaster"
public let couponWidgetDataKey = "CouponWidgetData"

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

    Function("reloadWidgets") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
