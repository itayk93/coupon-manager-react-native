import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>קופון מאסטר</title>
        {/* The native builds load Heebo through expo-font, which registers the
            faces under names like `Heebo_400Regular`. On web the styles ask for
            the plain `Heebo` family, so it has to be fetched here or every
            screen silently falls back to the system sans-serif. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                height: 100%;
                margin: 0;
                padding: 0;
                background-color: #edf2f7;
                font-family: Heebo, sans-serif;
              }
              #root {
                display: flex;
                height: 100%;
                flex: 1;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
