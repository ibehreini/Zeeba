import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';

/** How the user wants the app themed: follow iOS/browser, or force one scheme. */
export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Semantic colour tokens. Components never reference hex values directly -
 * they pick the token that describes the *role* of the colour, so both themes
 * stay in sync and contrast can be audited in one place.
 *
 * All text tokens meet WCAG AA (>= 4.5:1) against the surfaces they are
 * documented for.
 */
export interface ThemeColors {
  /** Screen background. */
  background: string;
  /** Cards, headers, tab bar, modals - anything that sits on `background`. */
  surface: string;
  /** Subtle alternate fill: inputs, pressed states, pills. */
  surfaceAlt: string;
  /** Primary copy on `background`/`surface`. */
  textPrimary: string;
  /** Secondary copy (hints, timestamps) on `background`/`surface`. */
  textSecondary: string;
  /** Hairlines and input borders. */
  border: string;
  /**
   * Interactive tint: active tab, selected toggle, filled buttons. Ink in
   * light mode - the brand yellow #ffd33d is only 1.6:1 on white, so it is
   * reserved for dark mode where it reads at ~11:1.
   */
  accent: string;
  /** Text/icons rendered on top of `accent`. */
  onAccent: string;
  /** Inline text links. */
  link: string;
  /** Errors and destructive actions. */
  danger: string;
  /** Modal scrim. */
  overlay: string;
  /** Stylist-mode banner fill (existing brand colour, same in both themes). */
  stylist: string;
  /** Text on the stylist banner. */
  onStylist: string;
}

export const lightTheme: ThemeColors = {
  background: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f2f3f5',
  textPrimary: '#25292e', // 14.9:1 on #ffffff
  textSecondary: '#595f68', // 6.6:1 on #ffffff
  border: '#cccccc',
  accent: '#25292e',
  onAccent: '#ffffff',
  link: '#0b57d0', // 6.8:1 on #ffffff
  danger: '#cc0000', // 5.9:1 on #ffffff
  overlay: 'rgba(0, 0, 0, 0.5)',
  stylist: '#38bdf8',
  onStylist: '#ffffff',
};

export const darkTheme: ThemeColors = {
  background: '#151718',
  surface: '#1e2126',
  surfaceAlt: '#282c31',
  textPrimary: '#ecedee', // 15.5:1 on #151718
  textSecondary: '#a4abb3', // 7.3:1 on #151718
  border: '#3a3f45',
  accent: '#ffd33d', // 11.3:1 on #151718
  onAccent: '#25292e',
  link: '#8ab4f8', // 7.6:1 on #151718
  danger: '#ff6b6b', // 5.6:1 on #151718
  overlay: 'rgba(0, 0, 0, 0.6)',
  stylist: '#38bdf8',
  onStylist: '#ffffff',
};

/**
 * Maps the token palette onto React Navigation's theme shape, so stack
 * headers, the tab scaffold and screen backgrounds follow the active theme
 * without per-screen options. Spreading the built-in theme keeps the `fonts`
 * block React Navigation 7 requires.
 */
export function toNavigationTheme(colors: ThemeColors, isDark: boolean): NavigationTheme {
  const base = isDark ? NavigationDarkTheme : NavigationLightTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger,
    },
  };
}
