import HeaderNav from '@/components/HeaderNav';
import { useTheme } from '@/context/ThemeContext';
import { usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type AppShellProps = PropsWithChildren<{
  /** Signed-out routes (sign-in) get the shell without nav chrome. */
  signedIn: boolean;
}>;

const MAIN_CONTENT_ID = 'main-content';

const focusMainContent = () => document.getElementById(MAIN_CONTENT_ID)?.focus();

/**
 * Web site chrome wrapped around the whole router tree: skip link, header nav,
 * <main>, footer. Keeping it here rather than inside (tabs)/_layout.web.tsx
 * means the detail routes (item/[id], outfit/[id], their edit screens) get the
 * same header instead of dead-ending without navigation.
 *
 * The ARIA landmark roles below are what react-native-web turns into real
 * <header>/<nav>/<main>/<footer> elements, giving screen readers the
 * landmark rotor that a native tab bar provides on iOS.
 */
export default function AppShell({ signedIn, children }: AppShellProps) {
  useAnnounceRouteChange();
  const { theme } = useTheme();

  return (
    <View style={[styles.shell, { backgroundColor: theme.background }]}>
      {signedIn && (
        <>
          <SkipLink />
          <HeaderNav />
        </>
      )}

      {/* tabIndex={-1} makes <main> a valid target for the skip link without
          adding it to the normal tab order. */}
      <View role="main" id={MAIN_CONTENT_ID} tabIndex={-1} style={styles.main}>
        {children}
      </View>

      {signedIn && <SiteFooter />}
    </View>
  );
}

/**
 * Announces client-side route changes to screen readers.
 *
 * A browser only tells assistive tech "this is a new page" on a real document
 * load. Every navigation here is a React re-render instead, so nothing moves
 * the screen reader's virtual cursor and it keeps reading the page the user
 * just left - most visibly after Back, where the button that had focus
 * unmounts with the old screen and focus drops to <body> with nothing
 * announced. This is the web stand-in for the screen-change notification iOS
 * posts on every push/pop for free, and it covers the header back button, the
 * browser's own Back button and every in-app link alike, because it keys off
 * the resulting path rather than off whatever triggered the navigation.
 *
 * The target is the new page's heading rather than <main>: <main> is the one
 * element that survives every navigation, and focusing an element that is
 * already focused fires no event at all, so screen readers heard nothing on
 * the second and every later navigation. A heading belongs to the screen, so
 * it is a genuinely different element each time - and it announces the page by
 * name instead of just "main".
 */
function useAnnounceRouteChange() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // A full page load already announces itself - stealing focus there would
    // skip the user past the header nav on arrival.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const main = document.getElementById(MAIN_CONTENT_ID);
    // Screens the navigators keep mounted but hidden (the inactive tabs, the
    // screen underneath a pushed one) still have their headings in the DOM;
    // `display: none` leaves them without a layout box, which is what
    // offsetParent filters out here.
    const heading = Array.from(main?.querySelectorAll<HTMLElement>('h1, h2, [role="heading"]') ?? []).find(
      node => node.offsetParent !== null,
    );

    const target = heading ?? main;
    if (!target) return;

    target.tabIndex = -1; // Headings aren't focusable on their own.
    target.focus();
  }, [pathname]);
}

/**
 * First tab stop on every page: off-screen until focused, then pinned to the
 * top-left, so keyboard users can jump the nav instead of tabbing through it
 * on every route.
 */
function SkipLink() {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      role="link"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={focusMainContent}
      style={[styles.skipLink, { backgroundColor: theme.accent }, focused && styles.skipLinkVisible]}
    >
      <Text style={[styles.skipLinkText, { color: theme.onAccent }]}>Skip to main content</Text>
    </Pressable>
  );
}

function SiteFooter() {
  const { theme } = useTheme();

  return (
    <View role="contentinfo" style={[styles.footer, { borderTopColor: theme.border }]}>
      <Text style={[styles.footerText, { color: theme.textSecondary }]}>
        Zeeba - your closet, organised.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  main: {
    flex: 1,
  },
  skipLink: {
    position: 'absolute',
    zIndex: 10,
    top: 8,
    left: -9999,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skipLinkVisible: {
    left: 8,
  },
  skipLinkText: {
    fontWeight: '600',
    fontSize: 15,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
});
