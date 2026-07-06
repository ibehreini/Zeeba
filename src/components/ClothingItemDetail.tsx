import { ClothingItemMap } from '@/constants/closetData';
import { Image } from 'expo-image'; // High-perf native component
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  itemId: string;
};

export default function ClothingItemDetail({ itemId }: Props) {
  const item = ClothingItemMap[itemId];

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Item not found!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={item.img}
          style={styles.image}
          contentFit="cover" // Modern prop replacing resizeMode
          transition={200}   // Smooth native fade-in in SDK 55
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={styles.contentContainer}>
        <Text accessibilityRole="header" style={styles.titleText}>{item.name}</Text>
        <Text style={styles.text}>{item.description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,                  // Takes up the whole screen dynamically
    backgroundColor: '#fff',  // White background (use 'transparent' for no background)
    justifyContent: 'center', // Centers content vertically
    alignItems: 'center',     // Centers content horizontally
  },
  // Centered wrapper for the image to mimic Amazon's frame
  imageContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: 'center',    // Centers the image horizontally
  },
  image: {
    width: '100%',          // Spans full width of its padded parent
    aspectRatio: 1,         // Forces a perfect square dynamically
    borderRadius: 8,        // Optional: slight rounding looks very modern
    backgroundColor: '#f9f9f9',
  },
  text: {
    fontSize: 17,
    lineHeight: 24,
    color: '#333',
  },
  contentContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'flex-start', // Keeps text left-aligned like Amazon
  },
  titleText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f1111',
    marginBottom: 8,
  },
});
