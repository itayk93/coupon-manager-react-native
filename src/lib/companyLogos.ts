import { getLogoAsset } from "./companyLogoAssets";
import { logoColorByFile } from "./companyLogoColors";

/**
 * Existing curated logos live on the legacy web host. Newly verified logos are
 * mirrored into the public `company-logos` bucket so their URLs stay under our
 * control. Older `companies.image_path` values remain relative to this root.
 */
const LEGACY_IMAGE_ROOT = "https://www.couponmasteril.com/static";
const STORAGE_LOGO_ROOT =
  "https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos";

/** Verified brand artwork kept in our own public bucket. */
const remoteLogoByCompany: Record<string, string> = {
  babka: "babka.png",
  base44: "base44.png",
  "food style": "food-style.png",
  "food.style": "food-style.png",
  "spa zone": "spa-zone.png",
  "אגאדיר": "agadir.png",
  agadir: "agadir.png",
  "בורגרסבר": "burgersbar.jpg",
  burgersbar: "burgersbar.jpg",
  "גודי": "goodi.png",
  goodi: "goodi.png",
  "גולף אנד קו": "golf-and-co.jpg",
  "golf & co": "golf-and-co.jpg",
  "לה פרינה": "la-farina.png",
  "la farina": "la-farina.png",
  "נונו ומימי": "nono-mimi.png",
  "nono & mimi": "nono-mimi.png",
  "תו הזהב": "tav-hazahav.png",
  "תן ביס": "tenbis.png",
  "10bis": "tenbis.png",
};

const logoByCompany: Record<string, string> = {
  carrefour: "carrefour.png",
  "קרפור": "carrefour.png",
  "מגה ספורט": "mega_sport.jpg",
  megasport: "mega_sport.jpg",
  goodpharm: "goodpharm.png",
  "גוד פארם": "goodpharm.png",
  xtra: "xtra.png",
  "אקסטרה": "xtra.png",
  buyme: "BuyMe.png",
  "ביימי": "BuyMe.png",
  "dream card": "dream_card.jpg",
  "power gift": "power_gift.jpeg",
  "פולגת": "polgat.png",
  polgat: "polgat.png",
  "פוקס הום": "fox_home.png",
  "fox home": "fox_home.png",
  "ניצת הדובדבן": "nitzan_haduvdevan.jpg",
  benedict: "benedict.jpeg",
  "בנדיקט": "benedict.jpeg",
  "נופשונית פלוס": "nofshonit_plus.png",
  "קפה עלית": "elite_coffee.png",
  "מאפה נאמן": "maafe_naaman.png",
  vans: "vans.jpeg",
  freefit: "freefit.png",
  roladin: "roladin.png",
  "רולדין": "roladin.png",
  wolt: "Wolt.png",
  "וולט": "Wolt.png",
  golda: "golda.png",
  "גולדה": "golda.png",
  "רמי לוי": "rami_levi.jpg",
  "קפה קפה": "cafe_cafe.png",
  laline: "Laline.png",
  "ללין": "Laline.png",
  "א.ל.מ.": "alm.jpg",
  "אלמ": "alm.jpg",
  alm: "alm.jpg",
  "ארקפה": "arcaffe.png",
  arcaffe: "arcaffe.png",
  "ארקיע": "arkia.png",
  arkia: "arkia.png",
  "אצה": "atza.avif",
  atza: "atza.avif",
  "be שופרסל": "be_shufersal.png",
  "be": "be_shufersal.png",
  "בן אנד ג׳ריס": "ben_and_jerrys.png",
  "בורגר קינג": "burger_king.png",
  "burger king": "burger_king.png",
  "בורגראנץ׳": "burger_ranch.png",
  "בורגראנץ": "burger_ranch.png",
  "סינמה סיטי": "cinema_city.png",
  "cinema city": "cinema_city.png",
  "סינמטק תל אביב": "cinematheque_tlv..png",
  "סינמטק": "cinematheque_tlv..png",
  "דומינוס פיצה": "dominos_pizza.png",
  "דומינוס": "dominos_pizza.png",
  "הוט סינמה": "hot_cinema.jpg",
  "hot cinema": "hot_cinema.jpg",
  "המלביה": "Hamalabiya.png",
  "itay brands": "itay_brands.png",
  kfc: "kfc.png",
  "לה שוק": "la_shuk.png",
  "לג׳נדה": "lagenda.png",
  "לגנדה": "lagenda.png",
  "love gift card": "love_gift_card.png",
  mcdonalds: "McDonalds.png",
  "מקדונלדס": "McDonalds.png",
  "מקדונלד'ס": "McDonalds.png",
  "מיקי שמו": "miki_shemo.png",
  "משלוחה": "mishloha.jpeg",
  mishloha: "mishloha.jpeg",
  "מובילנד": "movieland.png",
  movieland: "movieland.png",
  "office depot": "office_depot_70.png",
  "אופיס דיפו": "office_depot_70.png",
  "מפעל הפיס כללי": "pais.png",
  "מפעל הפיס מקומי": "pais.png",
  "מפעל הפיס": "pais.png",
  "פנדורה": "pandora.jpg",
  pandora: "pandora.jpg",
  "פאפא ג׳ונס": "papa_johns.png",
  "פאפא ג'ונס": "papa_johns.png",
  "פעלטון": "peloton.jpeg",
  "פיצה האט": "pizza_hut.png",
  "pizza hut": "pizza_hut.png",
  "רב חן": "rav_chen.png",
  "ריבר": "rebar.png",
  rebar: "rebar.png",
  "שובר מסעדות": "restaurants_coupon.jpg",
  "תו פלוס": "tav_plus.png",
  "ביחד בשבילך": "together_for_you.png",
  "ויקטורי": "victory.jpg",
  victory: "victory.jpg",
  "יס פלאנט": "yes_planet.jpg",
  "yes planet": "yes_planet.jpg",
  airalo: "airalo.png",
  "מחסני חשמל": "מחסני_חשמל_68_manual.png",
};

export function hasStaticLogo(company: string) {
  if (!company) return false;
  const trimmed = company.trim();
  return Boolean(
    logoByCompany[trimmed.toLowerCase()] ||
      logoByCompany[trimmed] ||
      remoteLogoByCompany[trimmed.toLowerCase()] ||
      remoteLogoByCompany[trimmed]
  );
}

export function getCompanyLogo(company: string) {
  return resolveCompanyLogo(company);
}

export function resolveCompanyLogo(company: string, dbImagePath?: string | null): string {
  const trimmed = (company || "").trim();

  if (dbImagePath && dbImagePath.trim() !== "" && dbImagePath !== "default.png" && dbImagePath !== "default_logo.png") {
    const cleanPath = dbImagePath.trim();

    if (/^https?:\/\//i.test(cleanPath)) {
      return cleanPath;
    }

    if (cleanPath.includes("/")) {
      return `${LEGACY_IMAGE_ROOT}/${cleanPath}`;
    }

    return `${LEGACY_IMAGE_ROOT}/images/${cleanPath}`;
  }

  // Preset logo from database/storage
  if (hasStaticLogo(trimmed)) {
    const file = logoByCompany[trimmed.toLowerCase()] || logoByCompany[trimmed];
    if (file && file !== "default.png") {
      return `${LEGACY_IMAGE_ROOT}/images/${file}`;
    }

    const remoteFile =
      remoteLogoByCompany[trimmed.toLowerCase()] || remoteLogoByCompany[trimmed];
    if (remoteFile) return `${STORAGE_LOGO_ROOT}/${remoteFile}`;
  }

  // Fallback to Google Favicon service
  if (trimmed) {
    const cleanDomain = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (cleanDomain.length >= 2) {
      return `https://www.google.com/s2/favicons?domain=${cleanDomain}.co.il&sz=128`;
    }
  }

  return `${LEGACY_IMAGE_ROOT}/images/default_logo.png`;
}

/**
 * Brand colour for the coupon card header.
 *
 * The colour comes from the logo itself: `companyLogoColors.ts` is generated by
 * `npm run logo-colors`, which extracts the dominant colour of every file in
 * public/legacy-images. Adding a logo therefore needs no colour work — drop the
 * file in, rerun the script, and the card picks the colour up.
 *
 * Overrides are only for companies whose logo is missing, is a white/greyscale
 * wordmark, or where the extracted colour is not the one people associate with
 * the brand.
 */
const colorOverrideByCompany: Record<string, string> = {
  base44: "#f97316",
  "בייס44": "#f97316",
  "itay brands": "#1f6fd1",
  "אצה": "#0ea472",
  atza: "#0ea472",
};

/** Companies with no logo colour and no override fall back to the app blue. */
const FALLBACK_BRAND_COLOR = "#1f6fd1";

export function getCompanyColor(company: string, dbImagePath?: string | null): string {
  const trimmed = (company || "").trim();

  const override =
    colorOverrideByCompany[trimmed.toLowerCase()] || colorOverrideByCompany[trimmed];
  if (override) return override;

  const dbFile = dbImagePath?.trim().split("/").pop();
  const file =
    (dbFile && logoColorByFile[dbFile] ? dbFile : undefined) ||
    logoByCompany[trimmed.toLowerCase()] ||
    logoByCompany[trimmed];

  return (file && logoColorByFile[file]) || FALLBACK_BRAND_COLOR;
}

/**
 * Image source for a company logo.
 *
 * Prefers the bundled asset (works on native and web); falls back to a remote
 * URL for DB-supplied paths and unknown companies.
 */
export function getCompanyLogoSource(
  company: string,
  dbImagePath?: string | null
): { uri: string } | number {
  const trimmed = (company || "").trim();

  const dbFile = dbImagePath?.trim();
  if (dbFile && !/^https?:\/\//i.test(dbFile)) {
    const bare = dbFile.split("/").pop();
    const asset = bare ? getLogoAsset(bare) : undefined;
    if (asset) return asset;
  }

  const file = logoByCompany[trimmed.toLowerCase()] || logoByCompany[trimmed];
  if (file) {
    const asset = getLogoAsset(file);
    if (asset) return asset;
  }

  const remoteFile =
    remoteLogoByCompany[trimmed.toLowerCase()] || remoteLogoByCompany[trimmed];
  if (remoteFile) return { uri: `${STORAGE_LOGO_ROOT}/${remoteFile}` };

  return { uri: resolveCompanyLogo(company, dbImagePath) };
}

/**
 * Coupon categories from the redesign's company table. Derived from the company
 * name so no schema change is needed; unknown companies fall into "אחר".
 */
const categoryByCompany: Record<string, string> = {
  carrefour: "סופר", "קרפור": "סופר",
  "רמי לוי": "סופר", "שופרסל": "סופר", shufersal: "סופר",
  "ויקטורי": "סופר", victory: "סופר", "יוחננוף": "סופר", "אושר עד": "סופר",
  kfc: "מסעדות", "קנטקי": "מסעדות", mcdonalds: "מסעדות", "מקדונלדס": "מסעדות",
  benedict: "מסעדות", "בנדיקט": "מסעדות", "קפה קפה": "מסעדות",
  "קפה עלית": "מסעדות", golda: "מסעדות", "גולדה": "מסעדות",
  roladin: "מסעדות", "רולדין": "מסעדות", "מאפה נאמן": "מסעדות",
  "ניצת הדובדבן": "מסעדות",
  wolt: "משלוחים", "וולט": "משלוחים",
  "fox home": "אופנה", "פוקס הום": "אופנה", foxhome: "אופנה",
  "פולגת": "אופנה", polgat: "אופנה", vans: "אופנה", "מגה ספורט": "אופנה",
  megasport: "אופנה", laline: "אופנה", "ללין": "אופנה",
  "סינמה סיטי": "בילוי", "cinema city": "בילוי",
  "יס פלאנט": "בילוי", "yes planet": "בילוי", freefit: "בילוי",
  "נופשונית פלוס": "בילוי",
  buyme: "שוברים", "ביימי": "שוברים", "dream card": "שוברים",
  "power gift": "שוברים", xtra: "שוברים", "אקסטרה": "שוברים",
  goodpharm: "פארם", "גוד פארם": "פארם",
  "מחסני חשמל": "חשמל", airalo: "תקשורת",
};

export function getCompanyCategory(company: string): string {
  const trimmed = (company || "").trim();
  return (
    categoryByCompany[trimmed.toLowerCase()] || categoryByCompany[trimmed] || "אחר"
  );
}

/**
 * Readable foreground for a brand colour. Bright brands (BuyMe yellow,
 * McDonald's yellow) need dark text; everything else stays white.
 */
export function getContrastText(hex: string): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}
