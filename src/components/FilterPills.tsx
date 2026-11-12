import { useTheme } from '@/context/ThemeContext';
import { announceForScreenReader } from '@/utils/announce';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

type Props<T extends string> = {
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T | null) => void;
  allLabel?: string;
  /** Display text for an option; defaults to the option value itself. */
  getLabel?: (option: T) => string;
  /** What the filter now shows ("Showing 4 items in Jackets"); spoken after the user changes the selection. */
  resultSummary?: string;
};

export default function FilterPills<T extends string>({
  options,
  selected,
  onSelect,
  allLabel = 'All',
  getLabel = option => option,
  resultSummary,
}: Props<T>) {
  // Only after a press: not on first render or when the data refreshes.
  const pressedRef = useRef(false);
  const [spoken, setSpoken] = useState('');
  useEffect(() => {
    if (!pressedRef.current || !resultSummary) return;
    pressedRef.current = false;
    announceForScreenReader(resultSummary);
    setSpoken(resultSummary); // for the web live region below
  }, [selected, resultSummary]);
  const select = (value: T | null) => {
    pressedRef.current = value !== selected;
    onSelect(value);
  };

  return (
    <>
      {Platform.OS === 'web' && (
        <Text role="status" aria-live="polite" style={styles.srOnly}>
          {spoken}
        </Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // ScrollView defaults to flexGrow: 1 AND flexShrink: 1, so the pills
        // row absorbed leftover vertical space (stretching the pills) when the
        // grid below was short, and got crushed to a sliver when the grid
        // overflowed. Pinning both keeps it at its natural content height.
        style={styles.scroll}
        contentContainerStyle={styles.row}
        accessibilityRole="tablist"
      >
        <Pill
          label={allLabel}
          isSelected={selected === null}
          onPress={() => select(null)}
        />
        {options.map(option => (
          <Pill
            key={option}
            label={getLabel(option)}
            isSelected={selected === option}
            onPress={() => select(selected === option ? null : option)}
          />
        ))}
      </ScrollView>
    </>
  );
}

type PillProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
};

/**
 * A tab rather than a button, so the selected pill actually announces as
 * selected. `aria-selected` is only honoured on tab/option-style roles - on a
 * button the browser drops it - and it's also what makes the row's `tablist`
 * role valid, since a tablist is only allowed to contain tabs.
 *
 * The state has to be passed as `aria-selected` and not the older
 * `accessibilityState={{ selected }}`: react-native-web 0.21 no longer maps
 * accessibilityState to anything, so it emitted no attribute at all and the
 * pill read as a plain "button" however it was styled. React Native maps
 * `aria-selected` back to the native selected state, so iOS is unchanged.
 */
function Pill({ label, isSelected, onPress }: PillProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      role="tab"
      aria-label={label}
      aria-selected={isSelected}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
        isSelected && { backgroundColor: theme.accent, borderColor: theme.accent },
        pressed && styles.pillPressed,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: isSelected ? theme.onAccent : theme.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Visually hidden but still read by screen readers.
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
  },
  pillPressed: {
    opacity: 0.8,
  },
  pillText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
