import { BarChart3, Bell, Handshake, Home, Share2, Ticket, User } from "lucide-react-native";
import type { NavIconName } from "@/lib/navigation";

/**
 * The glyph for each destination in `buildNavItems`. Kept beside the two
 * navigation components rather than in `lib/`, which stays free of React.
 */
export const NAV_ICONS: Record<NavIconName, typeof Home> = {
  home: Home,
  ticket: Ticket,
  share: Share2,
  handshake: Handshake,
  bell: Bell,
  user: User,
  chart: BarChart3,
};
