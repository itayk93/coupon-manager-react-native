import React from "react";
import { DashboardScreen } from "@/screens/dashboard/DashboardScreen";
import { HomeAltScreen } from "@/screens/dashboard/HomeAltScreen";
import { useHomeScreen } from "@/hooks/useHomeScreen";

/**
 * The home tab, whichever home the person picked in settings.
 *
 * While the preference is still being read the classic screen renders, not a
 * spinner: this is the first thing after launch, and a blank frame to avoid a
 * one-render flicker is a worse trade than the flicker.
 */
export default function HomeTab() {
  const { choice } = useHomeScreen();
  return choice === "kuponi" ? <HomeAltScreen /> : <DashboardScreen />;
}
