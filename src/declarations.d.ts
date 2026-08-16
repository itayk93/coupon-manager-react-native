/**
 * Ambient declarations for modules that ship no types of their own.
 *
 * Everything else (react-native, expo-*, navigation, lucide-react-native, ...)
 * now resolves to the real types from the installed packages. Do not re-declare
 * a typed package here: a `declare module` block wins over the package's own
 * typings and silently replaces them with `any`.
 */

declare module "react-native-qrcode-svg" {
  import type { ComponentType } from "react";

  export type QRCodeProps = {
    value?: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    logo?: unknown;
    logoSize?: number;
    logoBackgroundColor?: string;
    logoMargin?: number;
    logoBorderRadius?: number;
    quietZone?: number;
    enableLinearGradient?: boolean;
    linearGradient?: string[];
    ecl?: "L" | "M" | "Q" | "H";
    getRef?: (ref: unknown) => void;
    onError?: (error: unknown) => void;
  };

  const QRCode: ComponentType<QRCodeProps>;
  export default QRCode;
}
