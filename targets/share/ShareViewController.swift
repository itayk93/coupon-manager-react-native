import UIKit
import UniformTypeIdentifiers

/// Headless share extension: it shows no UI of its own. It writes the shared
/// screenshot into the App Group container and hands control to the app, which
/// runs the existing AI usage detection on it.
///
/// Keep the group id and file name in sync with
/// `modules/coupon-widget/ios/CouponWidgetModule.swift`.
private let appGroup = "group.com.itaykarkason.couponmaster"
private let sharedImageName = "shared-usage-screenshot.jpg"
private let appURL = "couponmaster://usage-import"

/// Screenshots arrive at full retina size, and the app base64-encodes the file
/// into an edge function request. 1600px keeps prices readable while staying
/// small enough to upload over cellular.
private let maxDimension: CGFloat = 1600

class ShareViewController: UIViewController {
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)

    guard
      let item = extensionContext?.inputItems.first as? NSExtensionItem,
      let provider = item.attachments?.first(where: {
        $0.hasItemConformingToTypeIdentifier(UTType.image.identifier)
      })
    else {
      return finish()
    }

    provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] value, _ in
      let image: UIImage? = {
        if let image = value as? UIImage { return image }
        if let url = value as? URL, let data = try? Data(contentsOf: url) { return UIImage(data: data) }
        if let data = value as? Data { return UIImage(data: data) }
        return nil
      }()

      if let image, let jpeg = downscaled(image).jpegData(compressionQuality: 0.7) {
        try? jpeg.write(to: sharedImageURL(), options: .atomic)
      }

      DispatchQueue.main.async {
        self?.openApp()
        self?.finish()
      }
    }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }

  /// A share extension cannot call `UIApplication.shared`, so walk the responder
  /// chain to whatever object does respond to `openURL:`.
  private func openApp() {
    guard let url = URL(string: appURL) else { return }
    var responder: UIResponder? = self
    let selector = sel_registerName("openURL:")
    while let current = responder {
      if current.responds(to: selector) {
        _ = current.perform(selector, with: url)
        return
      }
      responder = current.next
    }
  }
}

private func sharedImageURL() -> URL {
  FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: appGroup)!
    .appendingPathComponent(sharedImageName)
}

private func downscaled(_ image: UIImage) -> UIImage {
  let longest = max(image.size.width, image.size.height)
  guard longest > maxDimension else { return image }

  let scale = maxDimension / longest
  let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
  return UIGraphicsImageRenderer(size: size).image { _ in
    image.draw(in: CGRect(origin: .zero, size: size))
  }
}
