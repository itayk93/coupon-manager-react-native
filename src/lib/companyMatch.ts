// Snap a company name detected by the AI to an existing company name, mirroring
// the mechanism used in the original Flask app (extract_coupon_detail_sms) and the
// iOS app (OpenAIClient.matchCompanyName): exact → case-insensitive → fuzzy
// (trim whitespace + punctuation). Returns the canonical existing name when a
// match is found, otherwise null so the caller can keep the detected name as-is.

const PUNCTUATION = /[!-/:-@[-`{-~׀-׏]+/g; // ASCII punctuation + Hebrew punctuation marks

function clean(value: string) {
  return value
    .toLowerCase()
    .replace(PUNCTUATION, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchCompanyName(detectedName: string, companyNames: string[]): string | null {
  const detected = detectedName.trim();
  if (!detected) return null;

  // 1. Direct exact match.
  const exact = companyNames.find((name) => name === detected);
  if (exact) return exact;

  // 2. Case-insensitive match (WOLT / wolt / Wolt all map to the stored name).
  const lowered = detected.toLowerCase();
  const caseMatch = companyNames.find((name) => name.toLowerCase() === lowered);
  if (caseMatch) return caseMatch;

  // 3. Fuzzy match: ignore whitespace and punctuation differences.
  const cleanedDetected = clean(detected);
  const fuzzy = companyNames.find((name) => clean(name) === cleanedDetected);
  if (fuzzy) return fuzzy;

  return null;
}
