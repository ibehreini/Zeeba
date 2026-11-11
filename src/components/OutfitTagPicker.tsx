import { useTheme } from '@/context/ThemeContext';
import { hasOutfitLabel, outfitLabelKey } from '@/services/dataService.types';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  /** The closet's tags, in display order. */
  options: readonly string[];
  /** Tags currently on the outfit. May include tags that are no longer in `options`. */
  value: readonly string[];
  onChange: (labels: string[]) => void;
  /** Spoken name of the group, e.g. "Tags, choose at least one". */
  groupLabel: string;
};

/**
 * Multi-select for an outfit's tags: one toggle chip per closet tag. An
 * outfit can carry several tags (outfits.labels is an array and the Outfits
 * filter matches any of them), so this is a set of checkboxes rather than a
 * single-choice select.
 *
 * Tags the outfit already has but that the owner has since removed from the
 * closet's list are shown after the others, ticked and marked "(removed)",
 * so they can be unticked - the only way an old tag can ever be cleared.
 *
 * Each chip is role="checkbox" with aria-checked: VoiceOver reads "Casual,
 * checkbox, checked", the web gets a real checkbox. Chips never disable or
 * unmount when pressed, so focus never moves.
 */
export default function OutfitTagPicker({ options, value, onChange, groupLabel }: Props) {
  const { theme } = useTheme();

  // Removed-from-closet tags still on the outfit, in the outfit's own order.
  const orphaned = value.filter(label => !hasOutfitLabel(options, label));

  const toggle = (label: string) => {
    const key = outfitLabelKey(label);
    const isOn = value.some(candidate => outfitLabelKey(candidate) === key);
    onChange(isOn ? value.filter(candidate => outfitLabelKey(candidate) !== key) : [...value, label]);
  };

  const renderChip = (label: string, removed: boolean) => {
    const checked = hasOutfitLabel(value, label);
    const name = removed ? `${label} (removed from your tags)` : label;
    return (
      <Pressable
        key={`${removed ? 'removed' : 'tag'}:${label}`}
        onPress={() => toggle(label)}
        role="checkbox"
        aria-checked={checked}
        aria-label={name}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
          checked && { backgroundColor: theme.accent, borderColor: theme.accent },
          pressed && styles.chipPressed,
        ]}
      >
        {/* The tick is decoration: the checked state is already spoken and
            shown by the fill, but it means colour isn't the only cue. */}
        <Text aria-hidden style={[styles.chipText, { color: checked ? theme.onAccent : theme.textPrimary }]}>
          {checked ? '✓ ' : ''}
          {label}
          {removed ? ' (removed)' : ''}
        </Text>
      </Pressable>
    );
  };

  return (
    <View role="group" aria-label={groupLabel} style={styles.wrap}>
      {options.map(label => renderChip(label, false))}
      {orphaned.map(label => renderChip(label, true))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
