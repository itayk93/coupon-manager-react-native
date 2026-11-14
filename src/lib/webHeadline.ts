import { Platform } from "react-native";

// Reel detail: balanced headlines. React Native has no text-wrap control, but
// the web build does (CSS text-wrap: balance). We tag heading Texts with a
// data attribute on web only; app/+html.tsx carries the one-line stylesheet
// that turns it into text-wrap: balance. On native this spreads to nothing.
export const webHeadlineProps: object =
  Platform.OS === "web"
    ? ({ dataSet: { headline: "true" } } as { dataSet: Record<string, string> })
    : {};
