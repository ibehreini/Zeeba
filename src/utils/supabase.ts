import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

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
