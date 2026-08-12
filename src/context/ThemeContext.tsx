import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ThemeColors, type ThemeMode } from '@/theme/theme';

// On web AsyncStorage is a thin wrapper over localStorage with the raw key,
// which is what lets the pre-paint script in src/app/+html.tsx read the same
// value before React loads.
const STORAGE_KEY = 'zeeba.theme-mode';

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.includes(value as ThemeMode);
}

type ThemeContextValue = {
  /** The active semantic colour palette. */
  theme: ThemeColors;
  /** The user's stored preference, not the resolved scheme. */
  mode: ThemeMode;
  /** Whether the *resolved* scheme (preference + OS setting) is dark. */
  isDark: boolean;
  /** Persist a new preference; 'system' returns control to the OS. */
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The OS colour scheme, re-rendering on every trait change - iOS automatic
 * sunset switching, Control Centre toggles and accessibility appearance
 * changes all arrive through the same `useColorScheme` subscription.
 *
 * Web needs a hydration guard: the statically exported HTML is rendered
 * without `matchMedia`, so the first client render must also say 'light' or
 * React would warn about a hydration mismatch. The real scheme applies one
 * effect-tick later.
 */
function useSystemColorScheme(): 'light' | 'dark' {
  const scheme = useColorScheme();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return 'light';
  return scheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (!cancelled && isThemeMode(stored)) setModeState(stored);
      })
      .catch(() => {
        // Unreadable storage just means the preference falls back to 'system'.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = (mode === 'system' ? systemScheme : mode) === 'dark';
    return {
      theme: isDark ? darkTheme : lightTheme,
      mode,
      isDark,
      setMode: (next: ThemeMode) => {
        setModeState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
          // Persistence is best-effort; the in-memory mode already applied.
        });
      },
    };
  }, [mode, systemScheme]);

  // Native: hold the first frame (still behind the splash screen) until the
  // stored preference is read, so a dark-mode user never sees a light flash.
  // Web can't do this - returning null would mismatch the static HTML - so it
  // renders 'system' for the tick the AsyncStorage read takes.
  if (!loaded && Platform.OS !== 'web') return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
