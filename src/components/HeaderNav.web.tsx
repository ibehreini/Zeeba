import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type NavItem = {
  href: '/' | '/closet' | '/outfits' | '/settings';
  label: string;
};

// Mirrors the four <Tabs.Screen> destinations in src/app/(tabs)/_layout.web.tsx.
// Logs and Edit tags are opened from Settings; isActive's prefix match keeps
// the Settings link current on /settings/logs and /settings/tags.
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/closet', label: 'My Closet' },
  { href: '/outfits', label: 'Outfits' },
  { href: '/settings', label: 'Settings' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// React Native's prop types don't declare `aria-current`, but react-native-web
// forwards every `aria-*` prop straight to the DOM. Spreading an indexed type
// is how we hand it through without an `any` cast at each call site.
function ariaCurrentPage(active: boolean): Record<string, string> {
  return active ? { 'aria-current': 'page' } : {};
}

/**
 * The web site header: brand plus the primary nav links that replace the
 * native bottom tab bar. Rendered once by AppShell.web.tsx so it also sits
 * above the detail routes (item/outfit) that live outside the tab group.
 *
 * `role="banner"` and `role="navigation"` render as real <header>/<nav>
 * landmarks under react-native-web, and expo-router's <Link> renders a real
 * <a href> - so browser link affordances (pointer cursor, Enter to activate,
 * middle-click, focus ring) all come for free.
 */
export default function HeaderNav() {
  const pathname = usePathname();
  const { theme } = useTheme();

  return (
    <View
      role="banner"
      style={[styles.banner, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
    >
      <View style={styles.bar}>
        <Text style={[styles.brand, { color: theme.textPrimary }]}>Zeeba</Text>

        <View role="navigation" aria-label="Primary" style={styles.nav}>
          {NAV_ITEMS.map(item => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={[
                  styles.link,
                  { color: active ? theme.textPrimary : theme.textSecondary },
                  // The active state is a colour *and* an underline, so it
                  // doesn't rely on colour alone to distinguish the current page.
                  active && { borderBottomColor: theme.textPrimary },
                ]}
                {...ariaCurrentPage(active)}
              >
                {item.label}
              </Link>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderBottomWidth: 1,
  },
  bar: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    // Lets the links wrap onto a second line on very narrow (320px) screens
    // instead of pushing the page into horizontal scroll.
    flexShrink: 1,
  },
  link: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
});
