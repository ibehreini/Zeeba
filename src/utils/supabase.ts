import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'

// AsyncStorage's web shim assumes `window` exists, which breaks Expo Router's
// SSR pass (web.output: "static" pre-renders in Node, before any window).
// Native has no SSR pass, so it always gets AsyncStorage; web falls back to
// supabase-js's own storage, which already guards for a missing `window`.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })

// supabase-js's token auto-refresh relies on a running JS timer, which RN
// suspends while the app is backgrounded. Tying it to AppState ensures a
// session that expired in the background is refreshed the moment the app
// comes back to the foreground instead of surfacing as a stale/invalid token.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}
