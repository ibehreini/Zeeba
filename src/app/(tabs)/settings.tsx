import { useIsFocused } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeMode } from '@/theme/theme';

const APPEARANCE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Layout constants live in StyleSheet.create; anything colour comes from the
 * active theme at render time via `useTheme()`. This split is the app's
 * pattern for themed screens: static styles never re-create on theme change,
 * and the dynamic objects are cheap literals merged per render.
 */
export default function SettingsScreen() {
  // See src/app/(tabs)/index.tsx - the web tab view keeps inactive tabs
  // mounted (only hidden via zIndex/pointer-events), so NVDA still reads
  // this screen after navigating away unless we aria-hide it ourselves.
  const isFocused = useIsFocused();
  const { session, isGuest, signOut } = useAuth();
  const { theme, mode, setMode } = useTheme();

  const fullName = session?.user.user_metadata?.full_name as string | undefined;
  const name = fullName ?? (isGuest ? 'Guest' : undefined);
  const email = session?.user.email;

  const card = { backgroundColor: theme.surface, borderColor: theme.border };
  const heading = { color: theme.textPrimary };
  const label = { color: theme.textSecondary };
  const value = { color: theme.textPrimary };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      aria-hidden={!isFocused}
    >
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, heading]} role="heading" aria-level={2}>
          Account
        </Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, label]}>Name</Text>
          <Text style={[styles.rowValue, value]}>{name ?? '—'}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, label]}>Email</Text>
          <Text style={[styles.rowValue, value]}>
            {email ?? (isGuest ? 'Browsing as guest' : '—')}
          </Text>
        </View>
      </View>

      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, heading]} role="heading" aria-level={2}>
          Appearance
        </Text>

        <View
          style={[styles.segmented, { borderColor: theme.border }]}
          role="radiogroup"
          aria-label="Theme"
        >
          {APPEARANCE_OPTIONS.map(option => {
            const selected = mode === option.value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.segment,
                  { backgroundColor: selected ? theme.accent : theme.surface },
                ]}
                onPress={() => setMode(option.value)}
                role="radio"
                aria-checked={selected}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: selected ? theme.onAccent : theme.textPrimary },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.hint, label]}>
          System follows your device&apos;s appearance setting.
        </Text>
      </View>

      <Pressable
        style={[styles.signOutButton, card]}
        onPress={signOut}
        role="button"
      >
        <Text style={[styles.signOutText, { color: theme.danger }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
