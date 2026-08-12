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
//
// The PWA tags below are what make Android offer "Install app" instead of a
// plain bookmark, and what makes the installed window open without browser
// chrome. Both platforms need feeding separately: Android reads
// public/manifest.json, while iOS ignores the manifest for Add to Home Screen
// and only honours the apple-* meta tags and apple-touch-icon link.
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
        <meta name="description" content={APP_DESCRIPTION} />

        <link rel="manifest" href="/manifest.json" />
        {/* Colours the Android status bar in the installed app. Matches the
            shell background in AppShell.web.tsx so the bar blends into the
            header rather than drawing a line across the top. */}
        <meta name="theme-color" content="#ffffff" />
        <meta name="application-name" content="Zeeba" />

        {/* iOS home-screen app. `apple-mobile-web-app-capable` is the tag that
            drops Safari's chrome; the title tag stops iOS from using the
            (empty) document <title> as the icon label. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Zeeba" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: rootStyles }} />
        {/* Dev builds deliberately skip registration: a service worker sitting
            in front of the Metro dev server serves stale bundles and makes
            fast refresh look broken. NODE_ENV is resolved when this document
            is rendered, so the script is simply absent from `expo start`. */}
        {process.env.NODE_ENV === 'production' ? (
          <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}

const APP_DESCRIPTION = 'Share your closet with a stylist and build outfits together.';

// Waits for `load` so registration never competes with the initial bundle
// download for bandwidth. Failure is non-fatal by design - an unsupported or
// blocked service worker should cost the user nothing but installability.
const registerServiceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

// `#main-content` is the skip-link target in src/components/AppShell.web.tsx.
// It's given tabIndex={-1} so it can receive programmatic focus; suppressing
// the outline stops that from drawing a ring around the whole page. Focus
// still moves, so screen readers continue reading from <main>.
const rootStyles = `
html{overscroll-behavior:none;}
#main-content:focus{outline:none;}
`;
