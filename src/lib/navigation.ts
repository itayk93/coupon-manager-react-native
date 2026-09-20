/**
 * The primary navigation, as data.
 *
 * Two components draw this list — the bar along the bottom of a phone and the
 * rail down the side of an iPad — so what the destinations are, and which one
 * a given path lights up, lives here rather than in either of them.
 */

export type NavIconName =
  | "home"
  | "ticket"
  | "share"
  | "handshake"
  | "bell"
  | "user"
  | "chart";

export type NavItem = {
  label: string;
  path: string;
  icon: NavIconName;
  /** Extra paths that should light this item up. */
  match: string[];
  /**
   * Optical-centering nudge, in pixels. Most lucide glyphs are centered in
   * their 24px box; `share-2` is drawn ~3 units left of center, so it reads
   * offset under its label without this.
   */
  iconNudgeX?: number;
};

/**
 * Declared right-to-left: דשבורד leads, as Hebrew expects.
 *
 * `roomy` is the iPad rail. Six labels under ten points of type is what kept
 * סטטיסטיקה off the phone's bottom bar; standing the same list up the side of
 * a tablet leaves room for it, so it comes back rather than staying buried in
 * the account page.
 */
export function buildNavItems({
  isAdmin,
  roomy = false,
}: {
  isAdmin: boolean;
  roomy?: boolean;
}): NavItem[] {
  const items: NavItem[] = [
    { label: "דשבורד", path: "/", icon: "home", match: [] },
    { label: "קופונים", path: "/coupons", icon: "ticket", match: ["/coupons", "/scanner"] },
    { label: "שיתופים", path: "/sharing", icon: "share", match: ["/sharing"], iconNudgeX: 2.5 },
    {
      label: "שותפים",
      path: isAdmin ? "/admin?tab=referrals" : "/invite",
      icon: "handshake",
      match: isAdmin ? ["/admin"] : ["/invite", "/referral-program"],
    },
    { label: "התראות", path: "/notifications", icon: "bell", match: ["/notifications"] },
    {
      label: "חשבון",
      path: "/settings",
      icon: "user",
      match: ["/settings", "/profile", ...(isAdmin ? [] : ["/admin"])],
    },
  ];

  if (!roomy) return items;

  // After קופונים, where the numbers it totals up come from.
  const statistics: NavItem = {
    label: "סטטיסטיקה",
    path: "/statistics",
    icon: "chart",
    match: ["/statistics"],
  };
  return [...items.slice(0, 2), statistics, ...items.slice(2)];
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.path === "/") return pathname === "/" || pathname === "/index";
  // item.path may carry a query string; matching is on `match` alone.
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
