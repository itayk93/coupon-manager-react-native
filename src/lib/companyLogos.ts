const logoByCompany: Record<string, string> = {
  carrefour: "carrefour.png",
  "מגה ספורט": "mega_sport.jpg",
  megasport: "mega_sport.jpg",
  goodpharm: "goodpharm.png",
  xtra: "xtra.png",
  buyme: "BuyMe.png",
  "dream card": "dream_card.jpg",
  "power gift": "power_gift.jpeg",
  "spa zone": "default.png",
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
  "רמי לוי": "rami_levi.jpg",
  "קפה קפה": "cafe_cafe.png",
  laline: "Laline.png",
};

export function getCompanyLogo(company: string) {
  const trimmed = company.trim();
  const normalized = trimmed.toLowerCase();
  return `/legacy-images/${logoByCompany[normalized] || logoByCompany[trimmed] || "default.png"}`;
}

// Whether we have a known static logo for this company (vs. the default placeholder).
export function hasStaticLogo(company: string) {
  const trimmed = company.trim();
  return Boolean(logoByCompany[trimmed.toLowerCase()] || logoByCompany[trimmed]);
}

// Resolve the best available logo for a company, preferring an admin-managed DB image_path,
// then the bundled static map, then a favicon-service fallback keyed off the company name.
export function resolveCompanyLogo(company: string, dbImagePath?: string | null) {
  const trimmed = (company || '').trim();
  if (dbImagePath) {
    // Absolute URL or a legacy image filename managed by an admin.
    return /^https?:\/\//.test(dbImagePath) ? dbImagePath : `/legacy-images/${dbImagePath}`;
  }
  if (hasStaticLogo(trimmed)) return getCompanyLogo(trimmed);
  // Fallback: Google favicon service (best-effort, brand-neutral).
  const guessDomain = `${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.il`;
  return `https://www.google.com/s2/favicons?domain=${guessDomain}&sz=64`;
}

