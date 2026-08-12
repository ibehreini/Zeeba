import { Stack } from 'expo-router';
import AppShell from '@/components/AppShell';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ClosetProvider } from '@/context/ClosetContext';
import { DataModeProvider } from '@/context/DataModeContext';
import { ToastProvider } from '@/components/Toast';

export default function RootLayout() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ToastProvider>
  );
}

function RootNavigator() {
  const { session, initializing, isGuest } = useAuth();
  if (initializing) return null;

  const signedIn = !!session || isGuest;

  return (
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
  );
}
