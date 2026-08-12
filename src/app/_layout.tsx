import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import AppShell from '@/components/AppShell';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ClosetProvider } from '@/context/ClosetContext';
import { DataModeProvider } from '@/context/DataModeContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import { toNavigationTheme } from '@/theme/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, initializing, isGuest } = useAuth();
  const { theme, isDark } = useTheme();

  const navigationTheme = useMemo(() => toNavigationTheme(theme, isDark), [theme, isDark]);

  // Colours the native root view that shows behind screen transitions and
  // modals, so dark mode never flashes white between screens. On web this
  // instead re-syncs what the pre-paint script in +html.tsx set from storage
  // (<html> background, the browser's colour-scheme and the PWA theme-color),
  // which would otherwise go stale when the theme is toggled in Settings.
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.style.backgroundColor = theme.background;
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.background);
      return;
    }
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background, isDark]);

  if (initializing) return null;

  const signedIn = !!session || isGuest;

  return (
    // NavigationThemeProvider feeds the palette to every stack header, the
    // tab scaffold and screen backgrounds; StatusBar flips the iOS status
    // icons between white-on-dark and black-on-light with the active theme.
    <NavigationThemeProvider value={navigationTheme}>
      <DataModeProvider>
        {/* Above the stack, not inside (tabs): navigating from a detail route
            (item/outfit) to a nav link pushes a *new* (tabs) screen rather than
            returning to the existing one, so a provider mounted there would
            remount and drop the stylist closet selection back to "My Closet". */}
        <ClosetProvider>
          {/* Pass-through on native; on web it adds the header nav, landmarks and
              footer around every route. See AppShell.web.tsx. */}
          <AppShell signedIn={signedIn}>
            <Stack>
              <Stack.Protected guard={signedIn}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="item/[id]" />
                <Stack.Screen name="item/edit/[id]" />
                <Stack.Screen name="outfit/[id]" />
                <Stack.Screen name="outfit/edit/[id]" />
              </Stack.Protected>
              <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="sign-in" options={{ headerShown: false }} />
              </Stack.Protected>
              <Stack.Screen name="+not-found" />
            </Stack>
          </AppShell>
        </ClosetProvider>
      </DataModeProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
