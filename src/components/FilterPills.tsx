import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

type Props<T extends string> = {
  options: T[];
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

function Pill({ label, isSelected, onPress }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [
        styles.pill,
        isSelected && styles.pillSelected,
        pressed && styles.pillPressed,
      ]}
    >
      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pillSelected: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  pillPressed: {
    opacity: 0.8,
  },
  pillText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textTransform: 'capitalize',
  },
  pillTextSelected: {
    color: '#fff',
  },
});
