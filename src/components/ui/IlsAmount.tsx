import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { formatIlsNumber } from "@/lib/formatIls";

type IlsAmountProps = TextProps & {
  value: number;
  currencyStyle?: TextStyle;
};

/** Amount display with a leading, visually quieter shekel sign. */
export function IlsAmount({ value, style, currencyStyle, ...props }: IlsAmountProps) {
  return (
    <Text {...props} maxFontSizeMultiplier={1.5} style={[{ writingDirection: "ltr" }, style]}>
      <Text style={currencyStyle}>₪</Text>{" "}{formatIlsNumber(value)}
    </Text>
  );
}
