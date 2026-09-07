# Dynamic Type & Text Scaling Resilience

## Background & Problem
iOS users frequently customize system font sizing in **Settings > Display & Brightness > Text Size** or via **Accessibility > Larger Text** (which allows scaling up to 310%).
In React Native, `<Text>` and `<TextInput>` components have `allowFontScaling={true}` enabled by default.

When font scaling is active:
- Text dimensions increase according to the user's OS preference.
- If UI containers use hardcoded `height` values (e.g. `height: 46`), larger text cannot expand vertically. This causes:
  1. Text clipping / truncation.
  2. Text overflowing container borders.
  3. Overlapping icons and adjacent elements.
  4. Buttons and inputs becoming unusable for low-vision users.

---

## Core Rules for Components

### 1. Prefer `minHeight` + `paddingVertical` Over Fixed `height`
Never lock interactive controls (buttons, inputs, cards) with rigid `height`:

```tsx
// ❌ BAD: Fixed height clips scaled text
const styles = StyleSheet.create({
  button: {
    height: 46,
    paddingHorizontal: 16,
  },
});

// ✅ GOOD: minHeight guarantees base size, paddingVertical allows natural growth
const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
```

### 2. Guard Against Unbounded Scaling with `maxFontSizeMultiplier`
While supporting accessibility is mandatory, unconstrained scaling (e.g. 310%) can destroy critical multi-column grids or badges.
The standard project multiplier cap is **`1.35`** (allowing up to 35% growth, sufficient for readability without breaking layout structure):

```tsx
<Text maxFontSizeMultiplier={1.35} style={styles.title}>
  {title}
</Text>
```

### 3. Global Default Protection
In `app/_layout.tsx`, global defaults ensure unadorned text does not break layouts:
```ts
if ((Text as any).defaultProps == null) {
  (Text as any).defaultProps = {};
}
(Text as any).defaultProps.maxFontSizeMultiplier = 1.35;

if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.35;
```

---

## Comparison: React Native vs Native iOS (Swift)

| Aspect | Native iOS (SwiftUI / UIKit) | React Native (Expo) |
|---|---|---|
| **Default behavior** | Hardcoded points (`.font(.system(size: 16))`) do NOT scale | `<Text>` scales automatically (`allowFontScaling=true`) |
| **Custom Fonts** | Requires `UIFontMetrics` or `@ScaledMetric` to scale | Scales automatically with font family tokens |
| **Primary Failure Mode** | Text remains tiny for accessibility users | Text grows into rigid `height` boxes and clips |
| **Remedy** | Adopt Dynamic Type styles / `UIFontMetrics` | Use `minHeight` + `paddingVertical` + `maxFontSizeMultiplier` |

---

## Component Checklist
When creating or modifying UI components:
- [ ] Container uses `minHeight` instead of `height` wherever text is contained.
- [ ] Flex containers have `flexWrap: "wrap"` or appropriate scrolling if text expands horizontally.
- [ ] Icon + Text rows use `alignItems: "center"` and allow text to wrap or shrink with `flex: 1, minWidth: 0`.
- [ ] Test in iOS Simulator with **Accessibility > Larger Text** enabled at 200%.
