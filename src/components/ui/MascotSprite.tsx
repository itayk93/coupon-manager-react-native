import React from "react";
import { MascotAnimation } from "./MascotAnimation";

/** Compatibility wrapper for the sharing screen. */
export function MascotSprite({ size = 160, accessibilityLabel }: { size?: number; accessibilityLabel: string }) {
  return <MascotAnimation size={size} state="talking" accessibilityLabel={accessibilityLabel} />;
}
