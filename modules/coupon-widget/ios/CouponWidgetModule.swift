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
    }

    Function("getWidgetData") { () -> String? in
      UserDefaults(suiteName: couponWidgetAppGroup)?.string(forKey: couponWidgetDataKey)
    }

    Function("reloadWidgets") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
