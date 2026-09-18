import React from "react";
import { Image, StyleSheet, type ImageStyle, type StyleProp } from "react-native";
import { wordmarkBox } from "@/lib/brandMark";

const SOURCE = require("../../../assets/branding/kuponi-wordmark/color-horizontal.png");

type Props = {
  /** Width in points. The height follows from the artwork's own proportions. */
  width: number;
  style?: StyleProp<ImageStyle>;
};

/**
 * The horizontal Kuponi wordmark.
 *
 * Five screens used to require the asset, repeat the Hebrew label, and hand a
 * StyleSheet a height they had worked out themselves. Four of them got it
 * wrong — three auth screens asked for 280x64 and the content header for
 * 180x38, against artwork that is 5:1 — and `contain` quietly letterboxed the
 * difference, which on the login screen was enough to push the terms links
 * under the fold. Stating a width here and deriving the rest means there is
 * nothing left to get wrong.
 */
export function BrandMark({ width, style }: Props) {
  return (
    <Image
      source={SOURCE}
      accessibilityLabel="קופון מאסטר"
      resizeMode="contain"
      style={[styles.mark, wordmarkBox(width), style]}
    />
  );
}

const styles = StyleSheet.create({
  // Narrower parents shrink the mark rather than letting it overflow.
  mark: { maxWidth: "100%" },
});
