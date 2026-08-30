import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { formatIlsNumber } from "@/lib/formatIls";

type IlsAmountProps = TextProps & {
  value: number;
  currencyStyle?: TextStyle;
};

/** Unbreakable LTR amount with the shekel sign on the visual left. */
export function IlsAmount({ value, style, currencyStyle, ...props }: IlsAmountProps) {
  return (
    <Text {...props} maxFontSizeMultiplier={1.5} style={[{ writingDirection: "ltr" }, style]}>
      <Text style={currencyStyle}>₪</Text>{"\u00A0"}{formatIlsNumber(value)}
    </Text>
  );
}
