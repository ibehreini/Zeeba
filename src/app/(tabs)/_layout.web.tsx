import { Tabs, useIsFocused } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import HeaderBanner from '@/components/HeaderBanner';

/**
 * Web version of the tab layout. The bottom tab bar is native chrome that has
 * no place in a browser, so it's suppressed entirely - the same four
 * destinations are the top nav links in HeaderNav.web.tsx. The tab *navigator*
 * stays, because it's what maps /closet, /outfits and /about to these screens
 * and keeps each section's nested stack state alive across navigations.
 *
 * No tabBarIcon options here either: the web nav is text links, so the icons
 * would only ship dead weight to the browser bundle.
 */
export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => null}
      screenLayout={({ children }) => <TabScene>{children}</TabScene>}
      screenOptions={{
        // The header sits outside screenLayout, so it needs hiding
        // separately - see TabScene. `navigation.isFocused()` is evaluated
        // on every navigator render, so it tracks the active tab.
        header: ({ options, navigation }) =>
          navigation.isFocused() ? <HeaderBanner title={options.title} /> : null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="closet" options={{ title: 'My Closet', headerShown: false }} />
      <Tabs.Screen name="outfits" options={{ title: 'Outfits', headerShown: false }} />
      <Tabs.Screen name="about" options={{ title: 'About' }} />
    </Tabs>
  );
}

/**
 * On web the tab view never unmounts a visited tab - it just stacks the scenes
 * absolutely and pushes the inactive ones behind with `zIndex: -1`. They stay
 * in the DOM, which means their headings stay in the screen reader's buffer
 * and their buttons stay in the keyboard tab order even though nothing is
 * visible. `display: none` is what actually takes an inactive tab out of both;
 * `aria-hidden` alone wouldn't remove the focus stops.
 */
function TabScene({ children }: PropsWithChildren) {
  const isFocused = useIsFocused();

  return (
    <View style={[styles.scene, !isFocused && styles.sceneHidden]} aria-hidden={!isFocused}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
  sceneHidden: {
    display: 'none',
  },
});
