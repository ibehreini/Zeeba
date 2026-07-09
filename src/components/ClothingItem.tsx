import type { ImageSource } from '@/services/dataService.types';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  source: ImageSource;
  accessibilityLabel: string;
  onPress: () => void;
  /**
   * Renders the card as selectable/selected (checkmark badge + highlighted
   * border) when provided - used by the outfit item picker. Leave undefined
   * for plain read-only grids (e.g. the Closet tab) so they render exactly
   * as before.
   */
  selected?: boolean;
};

export default function ClothingItem({ source, accessibilityLabel, onPress, selected }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [
        styles.container,
        selected && styles.containerSelected,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Image
        source={source}
        style={styles.image}
        contentFit="contain" // Keeps the entire item visible without clipping
        transition={200}
      />
      {selected && (
        <View style={styles.checkBadge}>
          <Text style={styles.checkBadgeText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // Crucial for 2-column grid layout
    margin: 6,
    aspectRatio: 3 / 4,       // Moved here to force the card container to be perfectly uniform
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    overflow: 'hidden',       // Ensures the background doesn't bleed past the border radius on iOS
  },
  containerSelected: {
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  image: {
    width: '100%',
    height: '100%',           // Fills the uniform container perfectly
    padding: 8,               // Gives clothes a little breathing room from the card edges
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
