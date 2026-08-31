import { describe, expect, it } from "vitest";
import {
  describeInstallTarget,
  installGuide,
  shouldOfferInstall,
} from "./installTarget";

// Real user agent strings. Made-up ones agree with whatever the parser does.
const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/137.0.7151.107 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/137.0 Mobile/15E148 Safari/605.1.15",
  galaxyChrome:
    "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  galaxySamsungInternet:
    "Mozilla/5.0 (Linux; Android 15; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  redmiMiBrowser:
    "Mozilla/5.0 (Linux; U; Android 14; he-il; Redmi Note 13 Pro Build/UKQ1) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 XiaoMi/MiuiBrowser/18.2.10",
  pixelChrome:
    "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  androidFacebook:
    "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/he_IL]",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.19.109",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
};

describe("describeInstallTarget", () => {
  it("reads an iPhone in Safari", () => {
    const target = describeInstallTarget(UA.iphoneSafari);
    expect(target.platform).toBe("ios");
    expect(target.browser).toBe("safari");
    expect(target.installable).toBe(true);
    // Apple has no install API, so there is never a one-tap button on iOS.
    expect(target.supportsPrompt).toBe(false);
  });

  it("does not mistake Chrome on an iPhone for Safari", () => {
    expect(describeInstallTarget(UA.iphoneChrome).browser).toBe("chrome");
    // It is still WebKit underneath, so it installs the same way.
    expect(describeInstallTarget(UA.iphoneChrome).installable).toBe(true);
  });

  it("knows Firefox on iOS cannot add to the home screen", () => {
    const target = describeInstallTarget(UA.iphoneFirefox);
    expect(target.browser).toBe("firefox");
    expect(target.installable).toBe(false);
  });

  it("reads a Galaxy in Chrome and offers the real prompt", () => {
    const target = describeInstallTarget(UA.galaxyChrome);
    expect(target.platform).toBe("android");
    expect(target.browser).toBe("chrome");
    expect(target.vendor).toBe("גלקסי");
    expect(target.supportsPrompt).toBe(true);
  });

  it("separates Samsung Internet from Chrome, though its UA claims both", () => {
    const target = describeInstallTarget(UA.galaxySamsungInternet);
    expect(target.browser).toBe("samsung");
    expect(target.vendor).toBe("גלקסי");
  });

  it("reads a Redmi in the Xiaomi browser", () => {
    const target = describeInstallTarget(UA.redmiMiBrowser);
    expect(target.browser).toBe("xiaomi");
    expect(target.vendor).toBe("רדמי");
    expect(target.supportsPrompt).toBe(false);
  });

  it("names a Pixel", () => {
    expect(describeInstallTarget(UA.pixelChrome).vendor).toBe("פיקסל");
  });

  it("spots an in-app browser on both platforms", () => {
    expect(describeInstallTarget(UA.androidFacebook).browser).toBe("in-app");
    expect(describeInstallTarget(UA.androidFacebook).installable).toBe(false);
    expect(describeInstallTarget(UA.iphoneInstagram).browser).toBe("in-app");
    expect(describeInstallTarget(UA.iphoneInstagram).installable).toBe(false);
  });
});

describe("shouldOfferInstall", () => {
  const mobile = { standalone: false, mobile: true };

  it("offers on a phone browser", () => {
    expect(shouldOfferInstall({ ...mobile, userAgent: UA.iphoneSafari })).toBe(true);
    expect(shouldOfferInstall({ ...mobile, userAgent: UA.galaxyChrome })).toBe(true);
  });

  it("stays quiet on a desktop", () => {
    expect(shouldOfferInstall({ ...mobile, mobile: false, userAgent: UA.desktopChrome })).toBe(false);
  });

  it("stays quiet once the app is already installed", () => {
    expect(shouldOfferInstall({ ...mobile, standalone: true, userAgent: UA.iphoneSafari })).toBe(false);
  });

  it("still speaks up inside a webview, where the advice is to leave it", () => {
    expect(shouldOfferInstall({ ...mobile, userAgent: UA.androidFacebook })).toBe(true);
  });
});

describe("installGuide", () => {
  it("walks an iPhone through the share sheet", () => {
    const guide = installGuide(describeInstallTarget(UA.iphoneSafari));
    expect(guide.steps).toHaveLength(3);
    expect(guide.steps[1]).toContain("הוסף למסך הבית");
    expect(guide.blocker).toBeNull();
  });

  it("keeps written steps for Chrome too, as the fallback behind the button", () => {
    // `beforeinstallprompt` is the happy path, not a guarantee: it does not
    // fire if the browser decides the app is not eligible yet.
    const guide = installGuide(describeInstallTarget(UA.galaxyChrome));
    expect(guide.steps.length).toBeGreaterThan(0);
    expect(guide.steps.join(" ")).toContain("הוסף למסך הבית");
  });

  it("uses Samsung Internet's own wording, not Chrome's", () => {
    const guide = installGuide(describeInstallTarget(UA.galaxySamsungInternet));
    expect(guide.steps.some((step) => step.includes("הוסף דף אל"))).toBe(true);
  });

  it("names the phone when the user agent gives it away", () => {
    expect(installGuide(describeInstallTarget(UA.redmiMiBrowser)).headline).toContain("הרדמי שלך");
    expect(installGuide(describeInstallTarget(UA.pixelChrome)).headline).toContain("הפיקסל שלך");
  });

  it("tells a webview visitor to open a real browser, and says why", () => {
    const guide = installGuide(describeInstallTarget(UA.androidFacebook));
    expect(guide.blocker).not.toBeNull();
    expect(guide.steps.join(" ")).toContain("Chrome");
  });

  it("sends a Firefox-on-iOS visitor to Safari", () => {
    const guide = installGuide(describeInstallTarget(UA.iphoneFirefox));
    expect(guide.blocker).toContain("ספארי");
  });
});

describe("gendered wording", () => {
  it("addresses a woman in the feminine, throughout the sheet", () => {
    const guide = installGuide(describeInstallTarget(UA.galaxyChrome), true);
    expect(guide.headline).toContain("התקיני");
    expect(guide.action).toBe("התקיני עכשיו");
    expect(guide.steps[0]).toContain("לחצי");
    expect(guide.steps[1]).toContain("בחרי");
    expect(guide.steps[2]).toContain("אשרי");
  });

  it("keeps the masculine as the default", () => {
    const guide = installGuide(describeInstallTarget(UA.galaxyChrome));
    expect(guide.headline).toContain("התקן");
    expect(guide.action).toBe("התקן עכשיו");
    expect(guide.steps[0]).toContain("לחץ");
  });

  it("inflects the irregular verbs on the iOS path too", () => {
    const female = installGuide(describeInstallTarget(UA.iphoneSafari), true);
    const male = installGuide(describeInstallTarget(UA.iphoneSafari));
    expect(male.headline).toContain("שים");
    expect(female.headline).toContain("שימי");
    expect(male.steps[1]).toContain("גלול");
    expect(female.steps[1]).toContain("גללי");
  });

  it("inflects the way out of a webview and out of Firefox", () => {
    expect(installGuide(describeInstallTarget(UA.androidFacebook), true).steps[0]).toContain("לחצי");
    expect(installGuide(describeInstallTarget(UA.iphoneFirefox), true).steps[0]).toContain("העתיקי");
  });
});
