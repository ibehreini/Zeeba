import { useTheme } from '@/context/ThemeContext';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

type Props<T extends string> = {
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T | null) => void;
  allLabel?: string;
};

export default function FilterPills<T extends string>({
  options,
  selected,
  onSelect,
  allLabel = 'All',
}: Props<T>) {
  return (
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
        onPress={() => onSelect(null)}
      />
      {options.map(option => (
        <Pill
          key={option}
          label={option}
          isSelected={selected === option}
          onPress={() => onSelect(selected === option ? null : option)}
        />
      ))}
    </ScrollView>
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
    textTransform: 'capitalize',
  },
});
