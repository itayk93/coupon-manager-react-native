const SUPABASE_STORAGE_URL = "https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public";

const logoByCompany: Record<string, string> = {
  // Brand mappings
  carrefour: "carrefour.png",
  "קרפור": "carrefour.png",
  "מגה ספורט": "mega_sport.jpg",
  megasport: "mega_sport.jpg",
  goodpharm: "goodpharm.png",
  xtra: "xtra.png",
  buyme: "BuyMe.png",
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
  golda: "golda.png",
  "גולדה": "golda.png",
  "רמי לוי": "rami_levi.jpg",
  "קפה קפה": "cafe_cafe.png",
  laline: "Laline.png",
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
  if (!company) return "/legacy-images/default.png";
  const trimmed = company.trim();
  const normalized = trimmed.toLowerCase();
  const file = logoByCompany[normalized] || logoByCompany[trimmed];
  if (file) return `/legacy-images/${file}`;
  return resolveCompanyLogo(company);
}

// Resolve the best available logo for a company:
// 1. Admin-managed DB image_path (full URL or Supabase Storage bucket path)
// 2. Bundled static preset map
// 3. Google favicon service fallback
export function resolveCompanyLogo(company: string, dbImagePath?: string | null) {
  const trimmed = (company || '').trim();

  if (dbImagePath && dbImagePath.trim() !== '' && dbImagePath !== 'default.png' && dbImagePath !== 'default_logo.png') {
    const cleanPath = dbImagePath.trim();

    // Full URL (Supabase Storage public URL or external HTTPS)
    if (/^https?:\/\//i.test(cleanPath)) {
      return cleanPath;
    }

    // Absolute or local legacy path
    if (cleanPath.startsWith('/') || cleanPath.startsWith('legacy-images/')) {
      return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    }

    // Supabase Storage path with bucket (e.g. logos/xxx.png or company-logos/xxx.png)
    if (cleanPath.includes('/')) {
      return `${SUPABASE_STORAGE_URL}/${cleanPath}`;
    }

    // Supabase Storage filename in default bucket
    return `${SUPABASE_STORAGE_URL}/logos/${cleanPath}`;
  }

  // Fallback to static preset logo
  if (hasStaticLogo(trimmed)) {
    const file = logoByCompany[trimmed.toLowerCase()] || logoByCompany[trimmed];
    if (file && file !== 'default.png') {
      return `/legacy-images/${file}`;
    }
  }

  // Fallback: Google favicon service only if an ASCII domain can be derived
  if (trimmed) {
    const cleanDomain = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (cleanDomain.length >= 2) {
      const guessDomain = `${cleanDomain}.co.il`;
      return `https://www.google.com/s2/favicons?domain=${guessDomain}&sz=64`;
    }
  }

  return "/legacy-images/default.png";
}

