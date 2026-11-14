import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Custom HTML root for the web build, identical to the expo-router default
// plus one stylesheet: balanced text wrapping for tagged headlines
// (see src/lib/webHeadline.ts).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style>{"[data-headline]{text-wrap:balance}"}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
