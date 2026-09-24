# dynamic-notifications

Vendored from [rit3zh/expo-dynamic-notifications](https://github.com/rit3zh/expo-dynamic-notifications)
at commit `5de059a` (MIT, see `LICENSE`). The upstream repo is an example app,
not a package, so the library part of its `src/` is copied here.

Local changes:

- `@/…` imports rewritten as relative paths, and `components/dynamic-notifications/*`
  moved to `parts/`, `components/ui/*` to `ui/`.
- `parts/overlay.tsx` renders nothing while no notification is showing, so the
  painted pill does not appear in screenshots.
- `index.ts` also exports `useDynamicNotifications` and `IDynamicNotification`.

The app does not use this folder directly: `src/components/ui/Island.tsx`
loads it on devices with a Dynamic Island and exposes `pushIsland`.
