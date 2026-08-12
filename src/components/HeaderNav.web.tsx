import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

type NavItem = {
  href: '/' | '/closet' | '/outfits' | '/about';
  label: string;
};

// Mirrors the four <Tabs.Screen> destinations in src/app/(tabs)/_layout.web.tsx.
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/closet', label: 'My Closet' },
  { href: '/outfits', label: 'Outfits' },
  { href: '/about', label: 'About' },
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

  return (
    <View role="banner" style={styles.banner}>
      <View style={styles.bar}>
        <Text style={styles.brand}>Zeeba</Text>

        <View role="navigation" aria-label="Primary" style={styles.nav}>
          {NAV_ITEMS.map(item => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={[styles.link, active && styles.linkActive]}
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e3e3e3',
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
    color: '#25292e',
  },
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  link: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#4a4f57',
    borderBottomWidth: 2,
    // The active state is a colour *and* an underline, so it doesn't rely on
    // colour alone to distinguish the current page.
    borderBottomColor: 'transparent',
  },
  linkActive: {
    color: '#25292e',
    borderBottomColor: '#25292e',
  },
});
