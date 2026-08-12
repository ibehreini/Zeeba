import { useTheme } from '@/context/ThemeContext';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text } from 'react-native';

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISPLAY_MS = 2500;
const FADE_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const [message, setMessage] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (text: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);

      // iOS/Android have no live-region concept; announce explicitly there.
      // On web, react-native-web's announceForAccessibility is a no-op, so
      // that platform relies on the always-mounted aria-live Text below.
      if (Platform.OS !== 'web') {
        AccessibilityInfo.announceForAccessibility(text);
      }

      setMessage(text);
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();

      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start();
      }, DISPLAY_MS);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.container, { opacity }]}>
        <Text
          // Inverse surface so the toast stands out on any screen in either theme.
          style={[styles.text, { backgroundColor: theme.textPrimary, color: theme.background }]}
          role="alert"
          aria-live={Platform.OS === 'web' ? 'polite' : 'off'}
        >
          {message}
        </Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 48,
    alignItems: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
