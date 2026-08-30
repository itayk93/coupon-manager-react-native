import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCOUNT_KEYS = [
  "coupon_form_draft",
  "onboarding_coupon_drafts",
  "offline:coupons:v1",
  "nearby_targets",
  "nearby_last_alert",
  "nearby_enabled",
  "coupon_master_biometric_enabled",
  "coupon_master_biometric_email",
  "where-bought-corrections",
  "local-expiry:plan:v1",
  "expiring_banner_dismissal",
] as const;

const IDENTITY_PREFIXES = [
  "onboarding_prefs:",
  "onboarding_completed:",
  "push_nudge_dismissed:",
  "push_primer_seen_v2:",
] as const;

const INSTALL_KEYS = [
  "referral:pending",
  "referral:install_id",
  "referral:claimed",
] as const;

/**
 * Removes account data that is stored only on this device.
 *
 * Sign-out clears the signed-in person's data but keeps the installation's
 * referral id. Account deletion also forgets that installation identifier.
 */
export async function clearLocalPrivateData(
  identity?: string | null,
  options: { forgetInstall?: boolean } = {},
): Promise<void> {
  const normalizedIdentity = identity?.trim().toLowerCase();
  const identityKeys = IDENTITY_PREFIXES.flatMap((prefix) => [
    `${prefix}guest`,
    ...(normalizedIdentity ? [`${prefix}${normalizedIdentity}`] : []),
  ]);
  const keys = [
    ...ACCOUNT_KEYS,
    ...identityKeys,
    ...(options.forgetInstall ? INSTALL_KEYS : []),
  ];

  await AsyncStorage.multiRemove(Array.from(new Set(keys)));
}
