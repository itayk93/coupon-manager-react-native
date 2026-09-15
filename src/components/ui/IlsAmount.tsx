import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useCountTo } from "@/hooks/useCountTo";
import { formatIlsNumber } from "@/lib/formatIls";

type IlsAmountProps = TextProps & {
  value: number;
  currencyStyle?: TextStyle;
  /** Counts from the old amount to the new one when it changes. For balances
   *  the user just moved — not for a figure that merely arrived from a fetch. */
  animate?: boolean;
  /** Counts up from zero on first render instead. For a celebration figure,
   *  where the amount arriving is the point. */
  countFromZero?: boolean;
};

/** Unbreakable LTR amount with the shekel sign on the visual left. */
export function IlsAmount({ value, style, currencyStyle, animate = false, countFromZero = false, ...props }: IlsAmountProps) {
  const shown = useCountTo(value, animate, countFromZero);
  return (
    <Text {...props} maxFontSizeMultiplier={1.5} style={[{ writingDirection: "ltr" }, style]}>
      <Text style={currencyStyle}>₪</Text>{"\u00A0"}{formatIlsNumber(shown)}
    </Text>
  );
}
