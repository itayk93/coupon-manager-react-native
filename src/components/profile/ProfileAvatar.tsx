import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

export const PROFILE_AVATARS = Array.from({ length: 20 }, (_, index) => `avatar:${index + 1}`);

type Props = {
  value?: string | null;
  size?: number;
};

export function ProfileAvatar({ value, size = 64 }: Props) {
  if (value && !value.startsWith("avatar:")) {
    return <Image source={{ uri: value }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  const parsed = Number(value?.split(":")[1] || 1);
  const variant = Number.isFinite(parsed) ? Math.max(1, Math.min(20, parsed)) - 1 : 0;
  const mint = variant % 2 === 1;
  const body = mint ? "#58DFC6" : "#2864F0";
  const accent = ["#FFD35A", "#FF8E8E", "#A98BFF", "#FFFFFF", "#53C7F2"][variant % 5];
  const eyeShift = (variant % 3) - 1;
  const mouth = variant % 4;
  const accessory = variant % 5;

  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="50" fill={mint ? "#E2FBF5" : "#E8F0FF"} />
        {accessory === 0 ? <Path d="M27 31 Q50 12 73 31" fill={accent} /> : null}
        {accessory === 1 ? <Circle cx="69" cy="22" r="10" fill={accent} /> : null}
        {accessory === 2 ? <Path d="M28 27 L39 9 L50 27 L61 9 L72 27" fill={accent} /> : null}
        {accessory === 3 ? <Rect x="25" y="16" width="50" height="11" rx="5" fill={accent} /> : null}
        {accessory === 4 ? <Path d="M36 25 Q50 5 64 25" stroke={accent} strokeWidth="10" strokeLinecap="round" /> : null}
        <Rect x="19" y="25" width="62" height="64" rx="27" fill={body} />
        <Ellipse cx={38 + eyeShift} cy="52" rx="10" ry="13" fill="#FFFFFF" />
        <Ellipse cx={62 + eyeShift} cy="52" rx="10" ry="13" fill="#FFFFFF" />
        <Circle cx={40 + eyeShift} cy="55" r="4.5" fill="#14213D" />
        <Circle cx={64 + eyeShift} cy="55" r="4.5" fill="#14213D" />
        <Circle cx={38.5 + eyeShift} cy="53.5" r="1.5" fill="#FFFFFF" />
        <Circle cx={62.5 + eyeShift} cy="53.5" r="1.5" fill="#FFFFFF" />
        {mouth === 0 ? <Path d="M40 70 Q50 79 60 70" stroke="#14213D" strokeWidth="3" fill="none" strokeLinecap="round" /> : null}
        {mouth === 1 ? <Ellipse cx="50" cy="72" rx="9" ry="7" fill="#14213D" /> : null}
        {mouth === 2 ? <Path d="M42 74 Q50 67 58 74" stroke="#14213D" strokeWidth="3" fill="none" strokeLinecap="round" /> : null}
        {mouth === 3 ? <Path d="M42 70 L58 70" stroke="#14213D" strokeWidth="3" strokeLinecap="round" /> : null}
        {variant >= 10 ? <Circle cx="25" cy="67" r="4" fill="#FF9AA2" opacity="0.75" /> : null}
        {variant >= 10 ? <Circle cx="75" cy="67" r="4" fill="#FF9AA2" opacity="0.75" /> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: "#FFFFFF" },
});
