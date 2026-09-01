import UIKit
import UniformTypeIdentifiers

/// Share extension for usage screenshots. It shows a small branded confirmation
/// card, writes the shared screenshot into the App Group container, then opens
/// the host app, which runs the existing AI usage detection on it.
///
/// Keep the group id and file names in sync with
/// `modules/coupon-widget/ios/CouponWidgetModule.swift`.
private let appGroup = "group.com.itaykarkason.couponmaster"
private let sharedImageName = "shared-usage-screenshot.jpg"
private let sharedTextName = "shared-coupon-text.txt"
private let sharedImportName = "shared-usage-import.json"

/// Deep link that brings the app to the foreground so the approval sheet opens
/// right away instead of on the next manual launch. The app polls the shared
/// container on `active`, so any route that foregrounds it is enough.
private let hostAppURL = URL(string: "couponmaster://shared-import")!
private let importMode = "add"

/// Screenshots arrive at full retina size, and the app base64-encodes the file
/// into an edge function request. 1600px keeps prices readable while staying
/// small enough to upload over cellular.
private let maxDimension: CGFloat = 1600

private enum Brand {
  static let blue = UIColor(red: 40 / 255, green: 100 / 255, blue: 240 / 255, alpha: 1)
  static let mint = UIColor(red: 88 / 255, green: 223 / 255, blue: 198 / 255, alpha: 1)
  static let cream = UIColor(red: 250 / 255, green: 249 / 255, blue: 246 / 255, alpha: 1)
  static let ink = UIColor(red: 24 / 255, green: 28 / 255, blue: 40 / 255, alpha: 1)
}

class ShareViewController: UIViewController {
  private let card = UIView()
  private let mascot = UIImageView(image: UIImage(named: "Mascot"))
  private let mascotWell = UIView()
  private let badge = UIImageView()
  private let titleLabel = UILabel()
  private let detailLabel = UILabel()
  private let progressTrack = UIView()
  private let progressBar = UIView()
  private var progressWidth: NSLayoutConstraint!
  private var didHandOff = false

  private var reduceMotion: Bool { UIAccessibility.isReduceMotionEnabled }

  override func viewDidLoad() {
    super.viewDidLoad()
    buildInterface()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    animateIn()
    startMascotIdle()
    loadSharedContent()
  }

  // MARK: - Work

  private func loadSharedContent() {
    guard
      let item = extensionContext?.inputItems.first as? NSExtensionItem,
      let attachments = item.attachments
    else {
      return finish()
    }

    if let provider = attachments.first(where: {
      $0.hasItemConformingToTypeIdentifier(UTType.image.identifier)
    }) {
      loadSharedImage(provider)
      return
    }

    if let provider = attachments.first(where: {
      $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)
        || $0.hasItemConformingToTypeIdentifier(UTType.text.identifier)
    }) {
      loadSharedText(provider)
      return
    }

    if let provider = attachments.first(where: {
      $0.hasItemConformingToTypeIdentifier(UTType.url.identifier)
    }) {
      loadSharedURL(provider)
      return
    }

    showFailure("לא מצאנו תמונה או טקסט בהודעה")
  }

  private func loadSharedImage(_ provider: NSItemProvider) {
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
          try? FileManager.default.removeItem(at: sharedTextURL())
          try jpeg.write(to: sharedImageURL(), options: .atomic)
          let job = SharedImportJob(
            id: UUID().uuidString,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            mode: importMode,
            state: "pending"
          )
          try JSONEncoder().encode(job).write(to: sharedImportURL(), options: .atomic)
          self.showReady()
        } catch {
          self.showFailure("לא הצלחנו לשמור את התמונה")
        }
      }
    }
  }

  private func loadSharedText(_ provider: NSItemProvider) {
    let typeIdentifier = provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)
      ? UTType.plainText.identifier
      : UTType.text.identifier

    provider.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { [weak self] value, _ in
      let text: String? = {
        if let text = value as? String { return text }
        if let attributed = value as? NSAttributedString { return attributed.string }
        if let data = value as? Data { return String(data: data, encoding: .utf8) }
        if let url = value as? URL { return try? String(contentsOf: url, encoding: .utf8) }
        return nil
      }()

      DispatchQueue.main.async {
        guard let self else { return }
        guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
          self.showFailure("לא הצלחנו לקרוא את הטקסט")
          return
        }
        do {
          try? FileManager.default.removeItem(at: sharedImageURL())
          try Data(text.utf8).write(to: sharedTextURL(), options: .atomic)
          let job = SharedImportJob(
            id: UUID().uuidString,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            mode: importMode,
            state: "pending"
          )
          try JSONEncoder().encode(job).write(to: sharedImportURL(), options: .atomic)
          self.showReady()
        } catch {
          self.showFailure("לא הצלחנו לשמור את הטקסט")
        }
      }
    }
  }

  private func loadSharedURL(_ provider: NSItemProvider) {
    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] value, _ in
      let text: String? = {
        if let url = value as? URL { return url.absoluteString }
        if let text = value as? String { return text }
        return nil
      }()

      DispatchQueue.main.async {
        guard let self else { return }
        guard let text, !text.isEmpty else {
          self.showFailure("לא הצלחנו לקרוא את הקישור")
          return
        }
        do {
          try? FileManager.default.removeItem(at: sharedImageURL())
          try Data(text.utf8).write(to: sharedTextURL(), options: .atomic)
          let job = SharedImportJob(
            id: UUID().uuidString,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            mode: importMode,
            state: "pending"
          )
          try JSONEncoder().encode(job).write(to: sharedImportURL(), options: .atomic)
          self.showReady()
        } catch {
          self.showFailure("לא הצלחנו לשמור את הקישור")
        }
      }
    }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }

  /// Walk the responder chain to `UIApplication` and open the host app. A share
  /// extension has no direct `openURL`, and `extensionContext.open` is a no-op
  /// for `com.apple.share-services` on current iOS, so this is the path that
  /// actually foregrounds the app.
  private func openHostApp() {
    var responder: UIResponder? = self
    while let current = responder {
      if let app = current as? UIApplication {
        app.open(hostAppURL, options: [:], completionHandler: nil)
        return
      }
      responder = current.next
    }
    extensionContext?.open(hostAppURL, completionHandler: nil)
  }

  // MARK: - States

  private func showReady() {
    guard !didHandOff else { return }
    didHandOff = true

    stopMascotIdle()
    setBadge(systemName: "checkmark", tint: Brand.mint)
    titleLabel.text = "פותחים..."
    detailLabel.text = ""
    fillProgress(to: 1)
    celebrateMascot()

    // Hand off while the confirmation is still on screen, then close.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in self?.openHostApp() }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { [weak self] in self?.finish() }
  }

  private func showFailure(_ message: String) {
    stopMascotIdle()
    setBadge(systemName: "exclamationmark.triangle.fill", tint: UIColor.systemOrange)
    titleLabel.text = "לא הצלחנו להכין את הקופון"
    detailLabel.text = message
    progressTrack.isHidden = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in self?.finish() }
  }

  // MARK: - Interface

  private func buildInterface() {
    view.backgroundColor = UIColor.black.withAlphaComponent(0.28)
    view.semanticContentAttribute = .forceRightToLeft

    card.backgroundColor = Brand.cream
    card.layer.cornerRadius = 30
    card.layer.cornerCurve = .continuous
    card.layer.shadowColor = UIColor.black.cgColor
    card.layer.shadowOpacity = 0.18
    card.layer.shadowRadius = 30
    card.layer.shadowOffset = CGSize(width: 0, height: 12)
    card.translatesAutoresizingMaskIntoConstraints = false
    card.alpha = 0
    card.transform = CGAffineTransform(translationX: 0, y: 16).scaledBy(x: 0.96, y: 0.96)

    // Mascot sits in a soft tinted "well" so it reads as a character, not clip art.
    mascotWell.backgroundColor = Brand.blue.withAlphaComponent(0.10)
    mascotWell.layer.cornerRadius = 52
    mascotWell.layer.cornerCurve = .continuous
    mascotWell.translatesAutoresizingMaskIntoConstraints = false

    mascot.contentMode = .scaleAspectFit
    mascot.translatesAutoresizingMaskIntoConstraints = false

    badge.contentMode = .center
    badge.backgroundColor = Brand.blue
    badge.tintColor = .white
    badge.layer.cornerRadius = 15
    badge.layer.borderWidth = 3
    badge.layer.borderColor = Brand.cream.cgColor
    badge.translatesAutoresizingMaskIntoConstraints = false
    setBadge(systemName: "sparkle.magnifyingglass", tint: Brand.blue)

    titleLabel.text = importMode == "add" ? "מוסיף קופון..." : "מסמן שימוש..."
    titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
    titleLabel.textColor = Brand.ink
    titleLabel.textAlignment = .center
    titleLabel.numberOfLines = 0

    detailLabel.text = ""
    detailLabel.font = .systemFont(ofSize: 15, weight: .regular)
    detailLabel.textColor = Brand.ink.withAlphaComponent(0.6)
    detailLabel.textAlignment = .center
    detailLabel.numberOfLines = 0

    progressTrack.backgroundColor = Brand.blue.withAlphaComponent(0.14)
    progressTrack.layer.cornerRadius = 4
    progressTrack.translatesAutoresizingMaskIntoConstraints = false
    progressBar.backgroundColor = Brand.blue
    progressBar.layer.cornerRadius = 4
    progressBar.translatesAutoresizingMaskIntoConstraints = false
    progressTrack.addSubview(progressBar)

    let textStack = UIStackView(arrangedSubviews: [titleLabel, detailLabel])
    textStack.axis = .vertical
    textStack.alignment = .center
    textStack.spacing = 6

    let stack = UIStackView(arrangedSubviews: [mascotWell, textStack, progressTrack])
    stack.axis = .vertical
    stack.alignment = .center
    stack.spacing = 22
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.setCustomSpacing(20, after: mascotWell)

    mascotWell.addSubview(mascot)
    mascotWell.addSubview(badge)
    card.addSubview(stack)
    view.addSubview(card)

    progressWidth = progressBar.widthAnchor.constraint(equalToConstant: 0)

    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
      card.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
      card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      card.widthAnchor.constraint(lessThanOrEqualToConstant: 360),

      stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 26),
      stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -26),
      stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 32),
      stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -30),

      mascotWell.widthAnchor.constraint(equalToConstant: 104),
      mascotWell.heightAnchor.constraint(equalToConstant: 104),
      mascot.topAnchor.constraint(equalTo: mascotWell.topAnchor, constant: 10),
      mascot.bottomAnchor.constraint(equalTo: mascotWell.bottomAnchor, constant: -10),
      mascot.leadingAnchor.constraint(equalTo: mascotWell.leadingAnchor, constant: 10),
      mascot.trailingAnchor.constraint(equalTo: mascotWell.trailingAnchor, constant: -10),

      badge.widthAnchor.constraint(equalToConstant: 30),
      badge.heightAnchor.constraint(equalToConstant: 30),
      badge.trailingAnchor.constraint(equalTo: mascotWell.trailingAnchor, constant: 2),
      badge.bottomAnchor.constraint(equalTo: mascotWell.bottomAnchor, constant: 2),

      progressTrack.widthAnchor.constraint(equalToConstant: 160),
      progressTrack.heightAnchor.constraint(equalToConstant: 8),
      progressBar.trailingAnchor.constraint(equalTo: progressTrack.trailingAnchor),
      progressBar.topAnchor.constraint(equalTo: progressTrack.topAnchor),
      progressBar.bottomAnchor.constraint(equalTo: progressTrack.bottomAnchor),
      progressWidth,
    ])

    // Indeterminate crawl until the file is written, then showReady fills it.
    view.layoutIfNeeded()
    fillProgress(to: 0.7, duration: 1.1)
  }

  private func setBadge(systemName: String, tint: UIColor) {
    let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .bold)
    badge.image = UIImage(systemName: systemName, withConfiguration: config)
    badge.backgroundColor = tint
  }

  private func fillProgress(to fraction: CGFloat, duration: TimeInterval = 0.35) {
    progressWidth.constant = 160 * max(0, min(1, fraction))
    UIView.animate(withDuration: reduceMotion ? 0 : duration, delay: 0, options: .curveEaseInOut) {
      self.view.layoutIfNeeded()
    }
  }

  // MARK: - Animation

  private func animateIn() {
    guard !reduceMotion else {
      card.alpha = 1
      card.transform = .identity
      return
    }
    UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0.4) {
      self.card.alpha = 1
      self.card.transform = .identity
    }
  }

  /// Calm vertical bob + tiny head tilt, matching the onboarding character rules
  /// (under 10 px of travel, subtle loop).
  private func startMascotIdle() {
    guard !reduceMotion else { return }
    let bob = CABasicAnimation(keyPath: "transform.translation.y")
    bob.fromValue = -4
    bob.toValue = 5
    bob.duration = 1.6
    bob.autoreverses = true
    bob.repeatCount = .infinity
    bob.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

    let tilt = CABasicAnimation(keyPath: "transform.rotation.z")
    tilt.fromValue = -0.05
    tilt.toValue = 0.05
    tilt.duration = 2.4
    tilt.autoreverses = true
    tilt.repeatCount = .infinity
    tilt.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

    mascot.layer.add(bob, forKey: "bob")
    mascot.layer.add(tilt, forKey: "tilt")
  }

  private func stopMascotIdle() {
    mascot.layer.removeAllAnimations()
  }

  private func celebrateMascot() {
    guard !reduceMotion else { return }
    let pop = CAKeyframeAnimation(keyPath: "transform.scale")
    pop.values = [1, 1.12, 0.97, 1.04, 1]
    pop.keyTimes = [0, 0.3, 0.55, 0.8, 1]
    pop.duration = 0.6
    pop.timingFunction = CAMediaTimingFunction(name: .easeOut)
    mascot.layer.add(pop, forKey: "pop")

    mascotWell.backgroundColor = Brand.mint.withAlphaComponent(0.16)
    UIView.animate(withDuration: 0.3) { self.mascotWell.backgroundColor = Brand.mint.withAlphaComponent(0.16) }
  }
}

private struct SharedImportJob: Codable {
  let id: String
  let createdAt: String
  let mode: String
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

private func sharedTextURL() -> URL {
  FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: appGroup)!
    .appendingPathComponent(sharedTextName)
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
