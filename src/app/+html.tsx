import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only root document (Expo Router convention: this file is never bundled
// for iOS/Android native, so it can't affect the native app experience).
//
// `interactive-widget=resizes-content` makes Chrome shrink the layout
// viewport - not just the visual viewport - when the on-screen keyboard
// opens. Every screen in this app sizes itself with flex/height:100% (no
// hardcoded vh), so that reflow alone keeps focused inputs and submit
// buttons above the keyboard instead of the keyboard just overlaying them.
//
// `overscroll-behavior` on <html> stops scroll chaining from any nested
// ScrollView/FlatList reaching the document, which is what triggers Chrome's
// native pull-to-refresh and the rubber-band glow on overscroll.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: rootStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// `#main-content` is the skip-link target in src/components/AppShell.web.tsx.
// It's given tabIndex={-1} so it can receive programmatic focus; suppressing
// the outline stops that from drawing a ring around the whole page. Focus
// still moves, so screen readers continue reading from <main>.
const rootStyles = `
html{overscroll-behavior:none;}
#main-content:focus{outline:none;}
`;
