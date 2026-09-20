# iPhone and iPad: one app, two shapes

## Background & problem

The app was drawn for a phone: one column, 16pt gutters, six destinations in a
bar along the bottom. `supportsTablet: true` has always been set, so it also
installs on an iPad — where that same sheet becomes a 1180pt line of Hebrew, a
coupon card as wide as a laptop, and a tab bar pinned to the far edge of a
two-handed device.

The fix is not a second design. It is the same design told what to do with
more room: the column stops growing, the cards become a grid, and the
navigation stands up along the side.

---

## The one rule: width decides, not the device

Nothing in the app asks whether it is running on an iPad. Everything asks how
wide it is, because an iPad is *not* always iPad-shaped — Split View and Slide
Over hand out phone widths, and the user can change them mid-session by
dragging a divider.

`src/lib/responsive.ts` holds the arithmetic (pure, unit-tested in
`responsive.test.ts`); `src/hooks/useResponsive.ts` is what screens call.

| Class | Width | What it is | Layout |
|---|---|---|---|
| `compact` | < 700pt | Every iPhone; iPad in Slide Over or a narrow Split View | Exactly what shipped: one column, bottom bar |
| `medium` | 700–1023pt | iPad mini/11" portrait | Centred column, 28pt gutters, icon rail |
| `expanded` | ≥ 1024pt | iPad landscape, 12.9" portrait | Grids up to 1120pt, 40pt gutters, labelled sidebar |

700pt rather than 768pt: an iPad mini in portrait is 744pt and should get the
tablet chrome, while the 2/3 Split View column on an 11" iPad (~694pt) is still
hand-sized and keeps the bottom bar.

The class decides the *chrome* — gutters, caps, where navigation lives. It does
not decide grids: those answer to the cards. A 694pt Split View column keeps
the bottom bar and still shows two coupon cards, because two of them fit.

---

## What a screen has to do

Most screens need one line. `useContentStyle` returns the centring, the cap and
the gutter; spread it *after* the screen's own padding style so it wins:

```tsx
const contentStyle = useContentStyle("reading");
...
<ScrollView contentContainerStyle={[styles.scrollContent, contentStyle]}>
```

- `"reading"` — forms, legal text, settings lists. Capped at 640pt, because
  past that the eye loses the start of the next line, which in Hebrew means
  losing the right edge.
- `"grid"` — dashboards and card lists. Capped at 1120pt.
- `"full"` — maps and the camera, which want every pixel.

On a phone the hook deliberately leaves `paddingHorizontal` alone: screens
differ, and the point of this is the iPad, not a global re-spacing of the app.

### Cards

`<ResponsiveGrid minItemWidth={320} maxColumns={3}>` wraps a list of cards. On a
phone it is a pass-through — no wrapper views, the same tree that shipped — and
it only becomes a grid when the cards would otherwise be stretched.

Never hardcode a column count. Pass the width below which a card stops working
and let `gridColumns` answer, so an untested screen size still lands right.

### The duo layout

The list and the thing it opens, side by side. It appears only above 856pt of
content — 380 for the list, 460 for the detail, 16 between them — which in
practice means an iPad in landscape, never a phone, never Split View.

`CouponsListScreen` keeps the list in a column on the right and renders `CouponDetailScreen` beside it as a pane;
tapping a card fills the pane instead of pushing a route, and the card that is
showing keeps the border it already draws when selected. Below that width the
list is the whole screen and the detail is a pushed route, exactly as before.

`CouponDetailScreen` takes `couponId`, `embedded` and `onDismiss` for this. A
pane is handed its coupon rather than reading the route, takes no safe-area
inset of its own (the window already did), and closes by clearing the selection
rather than popping a route that was never pushed. It is keyed on the coupon,
so opening a second one starts fresh instead of carrying the first one's scroll
position and half-open sheets across.

Rotating to portrait takes the second column away and clears the selection. The
alternative — pushing the open coupon as a route — is a navigation the user did
not ask for, fired by turning the device.

On every width the app ships to:

| Device | Splits | List pane | Detail pane | Cards per row in the list |
|---|---|---|---|---|
| iPhone, Slide Over, 1/2 Split View | no | whole screen | pushed route | 1 |
| 2/3 Split View (694pt) | no | whole screen | pushed route | 2 |
| iPad mini portrait (744pt) | no | 652 | pushed route | 1 |
| iPad 11"/Pro portrait | no | 742 / 792 | pushed route | 2 |
| iPad 11" landscape (1194pt) | yes | 380 | 566 | 1 |
| iPad Pro landscape (1366pt) | yes | 380 | 738 | 1 |

The mini showing one card where a *narrower* 2/3 Split View shows two is not a
bug: the mini is wide enough for the icon rail, which takes 92pt off the
content before the cards see it. Two cards would be 292pt each, and the card
stops working below 320.

Which is the point of asking `columns(320, 2)` rather than a width threshold.
Nothing in either screen compares a width itself.

Nothing is hidden by the split and nothing is added by it. The same content
changes shape.

### TwoPane, and why nothing uses it yet

`<TwoPane primary={…} secondary={…} />` is the same idea one level down: two
columns inside a single screen where there is room, one stack everywhere else.
It is written and it works, and no screen calls it.

The obvious candidate is the coupon detail — the coupon itself on the right,
everything about it (link, widget, tags, history, map) beside it. But it would
never fire. `TwoPane` splits at the same 856pt, and the detail is only ever a
pane 566-738pt wide (in landscape, where the list screen has already split) or
a pushed route on an iPad in portrait, where the content is 742-792. There is
no shipped width at which the detail screen has 856pt to itself.

So it waits for a screen that does: a settings page, a statistics view, or the
detail screen if the list pane ever gets narrower. Adding a call that cannot
fire would only be dead code that reads as a feature.

### Panes measure themselves

A pane is not the window. `<LayoutWidth width={…}>` puts the pane's width into
context, and `useResponsive` inside it answers for the pane — so the detail
pane at 500pt lays itself out as the phone screen it now is, gutters, caps and
all, while the iPad around it stays an iPad. Without this a pane would keep
reading 1194pt and pad itself to nothing.

---

## Navigation

`BottomNav` renders only in `compact`; `SideNav` renders only above it, so the
two are never both on screen. Both read the same list from
`src/lib/navigation.ts` — the rail gets סטטיסטיקה back, which only ever left
the phone's bar because six labels under ten points of type was already tight.

Both live in the root layout inside a fixed `row-reverse` shell, so rotating an
iPad across the breakpoint moves the navigation **without remounting the
navigator** under it.

---

## Orientation

`app.json` keeps `"orientation": "portrait"` — that is right for a phone — and
adds `UISupportedInterfaceOrientations~ipad` with all four orientations. iOS
honours the device-specific key on an iPad and the plain one everywhere else,
so the iPhone and Android builds are untouched. Multitasking (Split View, Slide
Over) is on by default; the `compact` class is what makes it safe.

---

## Checklist for a new screen

- [ ] Main scroll container takes `useContentStyle(kind)` for the right `kind`.
- [ ] Stacks of cards go through `ResponsiveGrid`, not a hardcoded `width: "48%"`.
- [ ] A lone wide control (submit button, bottom action bar) takes `useCappedWidth()`.
- [ ] Anything comparing widths itself uses `useResponsive()`, never a bare `width >= 768`.
- [ ] Checked in the simulator at: iPhone SE, iPad mini portrait, iPad Pro
      landscape, and an iPad with the app in a 1/2 Split View.

---

## What each width ends up with

Run `npm test -- responsive` to see these pinned as assertions.

| Device | Content width | Coupon cards | Statistics figures | Company tiles | Navigation |
|---|---|---|---|---|---|
| iPhone SE (320pt) | 288 | 1 | 2 | 3 | bottom bar |
| iPhone 15 (393pt) | 361 | 1 | 2 | 3 | bottom bar |
| iPad 1/2 Split View (507pt) | 475 | 1 | 2 | 3 | bottom bar |
| iPad mini portrait (744pt) | 596 | 2 | 4 | 6 | icon rail |
| iPad 11" portrait (834pt) | 686 | 2 | 4 | 6 | icon rail |
| iPad 11" landscape (1194pt) | 882 | 3 | 4 | 6 | sidebar + duo panes |
| iPad Pro landscape (1366pt) | 1040 | 3 | 4 | 6 | sidebar + duo panes |

"Coupon cards" is the dashboard grid. In the duo layout the coupons list is a
column beside the coupon it opened, so it goes back to one card per row there —
the pane, not the iPad, is what it measures.
