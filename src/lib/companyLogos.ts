import { getLogoAsset } from "./companyLogoAssets";

const SUPABASE_STORAGE_URL = "https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public";

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
  return Boolean(logoByCompany[trimmed.toLowerCase()] || logoByCompany[trimmed]);
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
      return `${SUPABASE_STORAGE_URL}/${cleanPath}`;
    }

    return `${SUPABASE_STORAGE_URL}/company-logos/${cleanPath}`;
  }

  // Preset logo from database/storage
  if (hasStaticLogo(trimmed)) {
    const file = logoByCompany[trimmed.toLowerCase()] || logoByCompany[trimmed];
    if (file && file !== "default.png") {
      return `${SUPABASE_STORAGE_URL}/company-logos/${file}`;
    }
  }

  // Fallback to Google Favicon service
  if (trimmed) {
    const cleanDomain = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (cleanDomain.length >= 2) {
      return `https://www.google.com/s2/favicons?domain=${cleanDomain}.co.il&sz=128`;
    }
  }

  return "https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/default.png";
}

/**
 * Brand colours used for the coupon card header in the redesign.
 * Companies outside this list get a stable colour derived from their name, so
 * the same company always renders the same colour.
 */
const colorByCompany: Record<string, string> = {
  carrefour: "#0055a4",
  "קרפור": "#0055a4",
  "רמי לוי": "#f47b20",
  ramilevi: "#f47b20",
  kfc: "#c8102e",
  "קנטקי": "#c8102e",
  wolt: "#00a9c2",
  "וולט": "#00a9c2",
  "fox home": "#22252b",
  "פוקס הום": "#22252b",
  foxhome: "#22252b",
  "סינמה סיטי": "#d81b23",
  "cinema city": "#d81b23",
  buyme: "#7c3aed",
  "ביימי": "#7c3aed",
  goodpharm: "#0ea472",
  "גוד פארם": "#0ea472",
  "שופרסל": "#e2001a",
  shufersal: "#e2001a",
  "יס פלאנט": "#d81b23",
  "yes planet": "#d81b23",
  xtra: "#1f6fd1",
  "אקסטרה": "#1f6fd1",
  "מגה ספורט": "#0055a4",
  "פולגת": "#22252b",
};

const fallbackPalette = [
  "#1f6fd1",
  "#7c3aed",
  "#0ea472",
  "#c8102e",
  "#f47b20",
  "#00a9c2",
  "#22252b",
  "#d81b23",
];

export function getCompanyColor(company: string): string {
  const trimmed = (company || "").trim();
  const direct = colorByCompany[trimmed.toLowerCase()] || colorByCompany[trimmed];
  if (direct) return direct;

  let hash = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return fallbackPalette[hash % fallbackPalette.length];
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
