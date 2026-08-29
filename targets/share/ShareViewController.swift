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
private let sharedImportName = "shared-usage-import.json"

/// Screenshots arrive at full retina size, and the app base64-encodes the file
/// into an edge function request. 1600px keeps prices readable while staying
/// small enough to upload over cellular.
private let maxDimension: CGFloat = 1600

class ShareViewController: UIViewController {
  private let card = UIView()
  private let titleLabel = UILabel()
  private let detailLabel = UILabel()
  private let spinner = UIActivityIndicatorView(style: .large)

  override func viewDidLoad() {
    super.viewDidLoad()
    buildInterface()
  }

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

      DispatchQueue.main.async {
        guard let self else { return }
        guard let image, let jpeg = downscaled(image).jpegData(compressionQuality: 0.7) else {
          self.showFailure("לא הצלחנו לקרוא את התמונה")
          return
        }
        do {
          try jpeg.write(to: sharedImageURL(), options: .atomic)
          let job = SharedImportJob(id: UUID().uuidString, createdAt: ISO8601DateFormatter().string(from: Date()), state: "pending")
          try JSONEncoder().encode(job).write(to: sharedImportURL(), options: .atomic)
          self.showReady()
        } catch {
          self.showFailure("לא הצלחנו לשמור את התמונה")
        }
      }
    }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }

  private func buildInterface() {
    view.backgroundColor = UIColor.black.withAlphaComponent(0.18)
    card.backgroundColor = UIColor(red: 250/255, green: 249/255, blue: 246/255, alpha: 1)
    card.layer.cornerRadius = 28
    card.translatesAutoresizingMaskIntoConstraints = false

    let ticket = UIImageView(image: UIImage(systemName: "ticket.fill"))
    ticket.tintColor = UIColor(red: 31/255, green: 111/255, blue: 209/255, alpha: 1)
    ticket.contentMode = .scaleAspectFit
    ticket.translatesAutoresizingMaskIntoConstraints = false

    titleLabel.text = "Coupon Master קורא את הקופון"
    titleLabel.font = .preferredFont(forTextStyle: .headline)
    titleLabel.textAlignment = .center
    titleLabel.numberOfLines = 0

    detailLabel.text = "שומרים את התמונה ומכינים אותה לזיהוי…"
    detailLabel.font = .preferredFont(forTextStyle: .subheadline)
    detailLabel.textColor = .secondaryLabel
    detailLabel.textAlignment = .center
    detailLabel.numberOfLines = 0

    spinner.color = ticket.tintColor
    spinner.startAnimating()

    let stack = UIStackView(arrangedSubviews: [ticket, titleLabel, detailLabel, spinner])
    stack.axis = .vertical
    stack.alignment = .center
    stack.spacing = 16
    stack.translatesAutoresizingMaskIntoConstraints = false
    card.addSubview(stack)
    view.addSubview(card)

    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
      card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 24),
      stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -24),
      stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 30),
      stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -30),
      ticket.widthAnchor.constraint(equalToConstant: 58),
      ticket.heightAnchor.constraint(equalToConstant: 58),
    ])
  }

  private func showReady() {
    spinner.stopAnimating()
    titleLabel.text = "התמונה מוכנה"
    detailLabel.text = "פתחו את Coupon Master. הזיהוי יתחיל מיד והמסך יהיה מוכן לאישור."
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { [weak self] in self?.finish() }
  }

  private func showFailure(_ message: String) {
    spinner.stopAnimating()
    titleLabel.text = "לא הצלחנו להכין את הקופון"
    detailLabel.text = message
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in self?.finish() }
  }
}

private struct SharedImportJob: Codable {
  let id: String
  let createdAt: String
  let state: String
}

private func sharedImageURL() -> URL {
  FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: appGroup)!
    .appendingPathComponent(sharedImageName)
}

private func sharedImportURL() -> URL {
  FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: appGroup)!
    .appendingPathComponent(sharedImportName)
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
