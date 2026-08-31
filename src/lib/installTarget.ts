/**
 * Working out how *this* phone installs a web app, and whether to ask at all.
 *
 * Two facts shape everything here.
 *
 * The first: the browser decides the steps, not the manufacturer. The same
 * Galaxy installs one way in Chrome and a completely different way in Samsung
 * Internet. Statcounter has Israel at Chrome 64%, Safari 26%, Samsung Internet
 * 8% (July 2026) — three browsers cover 98% of the phones that will ever see
 * this. The vendor split (Samsung 47%, Apple 32%, Xiaomi 12%) is worth knowing
 * only so the copy can say "הגלקסי שלך" instead of "המכשיר שלך".
 *
 * The second: Android can offer a real install button and iOS cannot. Chrome
 * fires `beforeinstallprompt` and installs in one tap; Safari has no such API
 * and never will, so iOS gets pictures of a menu instead. Pretending otherwise
 * produces a button that does nothing.
 *
 * Kept free of React and DOM globals so every branch can be tested by handing
 * it a user agent string.
 */

export type InstallPlatform = "ios" | "android" | "other";

export type InstallBrowser =
  | "safari"
  | "chrome"
  | "samsung"
  | "firefox"
  | "edge"
  | "opera"
  | "xiaomi"
  | "huawei"
  | "in-app"
  | "unknown";

export type InstallTarget = {
  platform: InstallPlatform;
  browser: InstallBrowser;
  /** Marketing name of the phone, when the UA gives one away. */
  vendor: string | null;
  /** Whether this browser can install a web app at all. */
  installable: boolean;
  /** Whether it can do it through `beforeinstallprompt` rather than a menu. */
  supportsPrompt: boolean;
};

export type InstallEnvironment = {
  userAgent: string;
  /** True when the page is already running as an installed app. */
  standalone: boolean;
  /** True on a touch device with a phone-sized screen. */
  mobile: boolean;
};

/**
 * Android model codes worth naming. Only the prefixes that are unambiguous:
 * guessing "vivo" off a two-letter code and getting it wrong is worse than
 * saying nothing, and the fallback copy reads fine without a brand.
 */
const ANDROID_VENDORS: Array<[RegExp, string]> = [
  [/\bSM-|\bGT-|\bSAMSUNG\b|\bGalaxy\b/i, "גלקסי"],
  [/\bRedmi\b/i, "רדמי"],
  [/\bPOCO\b/i, "פוקו"],
  [/\bXiaomi\b|\bMi \d|\bMIX \d/i, "שיאומי"],
  [/\bPixel\b/i, "פיקסל"],
  [/\bOnePlus\b/i, "וואנפלוס"],
  [/\bmoto |\bMotorola\b/i, "מוטורולה"],
  [/\bCPH\d|\bOPPO\b/i, "אופו"],
  [/\bRMX\d|\brealme\b/i, "ריאלמי"],
  [/\bNokia\b/i, "נוקיה"],
  [/\bHONOR\b/i, "הונור"],
  [/\bHUAWEI\b/i, "וואווי"],
];

/**
 * Browsers that render inside another app. They have no install menu at all —
 * Facebook, Instagram, WhatsApp and Telegram all open links in a webview — so
 * the only useful advice is "open this in your real browser first".
 */
const IN_APP = /\bFBAN\b|\bFBAV\b|\bFB_IAB\b|Instagram|\bLine\/|\bMicroMessenger\b|\bTwitter\b|\bWhatsApp\b|\bTelegram\b|\bLinkedInApp\b|\bGSA\/|\bOKApp\b/i;

function detectVendor(userAgent: string): string | null {
  for (const [pattern, name] of ANDROID_VENDORS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}

function detectBrowser(userAgent: string, platform: InstallPlatform): InstallBrowser {
  if (IN_APP.test(userAgent)) return "in-app";
  if (/SamsungBrowser/i.test(userAgent)) return "samsung";
  if (/\bMiuiBrowser\b|\bXiaoMi\/MiuiBrowser\b/i.test(userAgent)) return "xiaomi";
  if (/\bHuaweiBrowser\b/i.test(userAgent)) return "huawei";
  // Order matters below: every one of these puts "Safari" in its UA on iOS,
  // and Chrome's own UA contains "Safari" on Android too.
  if (/\bFxiOS\b|\bFirefox\//i.test(userAgent)) return "firefox";
  if (/\bEdgiOS\b|\bEdgA?\//i.test(userAgent)) return "edge";
  if (/\bOPR\/|\bOPT\/|\bOpera\b/i.test(userAgent)) return "opera";
  if (/\bCriOS\b/i.test(userAgent)) return "chrome";
  if (/\bChrome\//i.test(userAgent) && platform !== "ios") return "chrome";
  if (platform === "ios" && /Safari/i.test(userAgent)) return "safari";
  return "unknown";
}

function detectPlatform(userAgent: string): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS reports itself as a Mac. The touch check in `readEnvironment` is
  // what separates it from a real desktop.
  if (/\bMacintosh\b/i.test(userAgent) && /Mobile/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

export function describeInstallTarget(userAgent: string): InstallTarget {
  const platform = detectPlatform(userAgent);
  const browser = detectBrowser(userAgent, platform);

  // iOS routes every browser through WebKit, so Chrome and Edge on an iPhone
  // install exactly the way Safari does — through the share sheet. Firefox on
  // iOS is the exception: its share menu has no "Add to Home Screen" entry.
  const iosInstallable = platform === "ios" && browser !== "in-app" && browser !== "firefox";
  const androidInstallable = platform === "android" && browser !== "in-app";

  return {
    platform,
    browser,
    vendor: platform === "android" ? detectVendor(userAgent) : null,
    installable: iosInstallable || androidInstallable,
    // Only Chromium on Android hands over a real install prompt. Everything
    // else needs the person to find a menu item themselves.
    supportsPrompt:
      platform === "android" && ["chrome", "edge", "opera", "samsung"].includes(browser),
  };
}

/** Whether the invitation is worth showing at all. */
export function shouldOfferInstall(environment: InstallEnvironment): boolean {
  if (environment.standalone) return false;
  if (!environment.mobile) return false;
  const target = describeInstallTarget(environment.userAgent);
  return target.platform === "ios" || target.platform === "android";
}

/**
 * Hebrew has no neutral imperative, so every step below exists twice. The
 * pairs are written out rather than assembled from a stem: "לחץ"/"לחצי" is
 * regular, "שים"/"שימי" and "גלול"/"גללי" are not, and a rule that gets those
 * wrong is worse than a table that gets them right.
 */
type Voice = { m: string; f: string };

const pick = (voice: Voice, female: boolean) => (female ? voice.f : voice.m);

export type InstallGuide = {
  /** One line naming the phone, so the sheet reads as if it is about them. */
  headline: string;
  /**
   * The taps, in order. Shown when no install button is on offer, and as the
   * fallback when a browser that should have fired `beforeinstallprompt`
   * never did.
   */
  steps: string[];
  /** The install button's own label, inflected the same way. */
  action: string;
  /** Shown when this browser cannot install at all. */
  blocker: string | null;
};

const IOS_SHARE_STEPS: Voice[] = [
  {
    m: "לחץ על כפתור השיתוף — הריבוע עם החץ למעלה, בסרגל התחתון",
    f: "לחצי על כפתור השיתוף — הריבוע עם החץ למעלה, בסרגל התחתון",
  },
  { m: 'גלול ברשימה ובחר "הוסף למסך הבית"', f: 'גללי ברשימה ובחרי "הוסף למסך הבית"' },
  { m: 'לחץ "הוסף" בפינה העליונה', f: 'לחצי "הוסף" בפינה העליונה' },
];


/**
 * What to tell the person in front of us.
 *
 * Written as taps they can follow without looking away from the screen, in the
 * wording each browser actually uses in Hebrew. A step that says "פתח את
 * התפריט" when the button is three dots in the corner is a step people fail.
 */
export function installGuide(target: InstallTarget, female = false): InstallGuide {
  const device = target.vendor ? `ה${target.vendor} שלך` : "המכשיר שלך";
  const install = female ? "התקיני" : "התקן";
  const put = female ? "שימי" : "שים";
  const action = female ? "התקיני עכשיו" : "התקן עכשיו";

  if (target.browser === "in-app") {
    return {
      headline: female ? "צריך לפתוח את הדף בדפדפן" : "צריך לפתוח את הדף בדפדפן",
      steps: [
        pick({ m: "לחץ על שלוש הנקודות בפינת המסך", f: "לחצי על שלוש הנקודות בפינת המסך" }, female),
        target.platform === "ios"
          ? pick({ m: 'בחר "פתח בדפדפן" או "Open in Safari"', f: 'בחרי "פתח בדפדפן" או "Open in Safari"' }, female)
          : pick({ m: 'בחר "פתח ב-Chrome" או "Open in browser"', f: 'בחרי "פתח ב-Chrome" או "Open in browser"' }, female),
        pick({ m: "חזור לכאן וההתקנה תופיע", f: "חזרי לכאן וההתקנה תופיע" }, female),
      ],
      action,
      blocker: "הדף נפתח בתוך אפליקציה אחרת, ומשם אי אפשר להתקין.",
    };
  }

  if (target.platform === "ios") {
    if (target.browser === "firefox") {
      return {
        headline: "פיירפוקס באייפון לא יודע להתקין",
        steps: [
          pick({ m: "העתק את הכתובת", f: "העתיקי את הכתובת" }, female),
          pick({ m: "פתח אותה בספארי", f: "פתחי אותה בספארי" }, female),
          pick({ m: "חזור לכאן וההוראות יופיעו", f: "חזרי לכאן וההוראות יופיעו" }, female),
        ],
        action,
        blocker: "אפל מאפשרת התקנה למסך הבית רק דרך ספארי.",
      };
    }
    const iosDevice = target.vendor ? `ה${target.vendor} שלך` : "האייפון שלך";
    return {
      headline: `${put} את קופון מאסטר על מסך הבית של ${iosDevice}`,
      steps: IOS_SHARE_STEPS.map((step) => pick(step, female)),
      action,
      blocker: null,
    };
  }

  if (target.platform === "android") {
    const headline = `${install} את קופון מאסטר על ${device}`;

    if (target.browser === "samsung") {
      return {
        headline,
        steps: [
          pick({ m: "לחץ על שלושת הקווים בפינה התחתונה", f: "לחצי על שלושת הקווים בפינה התחתונה" }, female),
          pick({ m: 'בחר "הוסף דף אל"', f: 'בחרי "הוסף דף אל"' }, female),
          pick({ m: 'בחר "מסך הבית"', f: 'בחרי "מסך הבית"' }, female),
        ],
        action,
        blocker: null,
      };
    }
    if (target.browser === "xiaomi" || target.browser === "huawei") {
      return {
        headline,
        steps: [
          pick({ m: "לחץ על שלוש הנקודות בסרגל התחתון", f: "לחצי על שלוש הנקודות בסרגל התחתון" }, female),
          pick({ m: 'בחר "הוסף למסך הבית"', f: 'בחרי "הוסף למסך הבית"' }, female),
          pick({ m: 'אשר בלחיצה על "הוסף"', f: 'אשרי בלחיצה על "הוסף"' }, female),
        ],
        action,
        blocker: null,
      };
    }
    if (target.browser === "firefox") {
      return {
        headline,
        steps: [
          pick({ m: "לחץ על שלוש הנקודות בפינה", f: "לחצי על שלוש הנקודות בפינה" }, female),
          pick({ m: 'בחר "התקן" או "הוסף למסך הבית"', f: 'בחרי "התקן" או "הוסף למסך הבית"' }, female),
          pick({ m: 'אשר בלחיצה על "הוסף"', f: 'אשרי בלחיצה על "הוסף"' }, female),
        ],
        action,
        blocker: null,
      };
    }
    return {
      headline,
      steps: [
        pick({ m: "לחץ על שלוש הנקודות בפינה העליונה", f: "לחצי על שלוש הנקודות בפינה העליונה" }, female),
        pick({ m: 'בחר "התקן אפליקציה" או "הוסף למסך הבית"', f: 'בחרי "התקן אפליקציה" או "הוסף למסך הבית"' }, female),
        pick({ m: 'אשר בלחיצה על "התקן"', f: 'אשרי בלחיצה על "התקן"' }, female),
      ],
      action,
      blocker: null,
    };
  }

  return { headline: "", steps: [], action, blocker: null };
}
