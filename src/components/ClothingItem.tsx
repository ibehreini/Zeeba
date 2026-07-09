import type { ImageSource } from '@/services/dataService.types';
import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

type Props = {
  source: ImageSource;
  accessibilityLabel: string;
  onPress: () => void;
};

export default function ClothingItem({ source, accessibilityLabel, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.container, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Image
        source={source}
        style={styles.image}
        contentFit="contain" // Keeps the entire item visible without clipping
        transition={200}
      />
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
  image: {
    width: '100%',
    height: '100%',           // Fills the uniform container perfectly
    padding: 8,               // Gives clothes a little breathing room from the card edges
  },
});
