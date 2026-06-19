import { Closet_Data } from '@/constants/closetData';
import { Image } from 'expo-image'; // High-perf native component
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  item_id: string;
};

export default function DetailClosetItem({ item_id }: Props) {
    const allItems = Closet_Data.flatMap((section) => section.data);
  const selectedItem = allItems.find((item) => item.id === item_id);

  // safety check if none are found
  if (!selectedItem) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Item not found!</Text>
      </View>
    );
  }

  // Once check is passed , TypeScript knows selectedItem DEFINITELY exists
  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image 
                source={selectedItem.img}
                style={styles.image} 
                contentFit="cover" // Modern prop replacing resizeMode
                transition={200}   // Smooth native fade-in in SDK 55
              />
              </View>
                    <View style={styles.contentContainer}>
          <Text style={styles.titleText}>{selectedItem.name}</Text>
                    <Text style={styles.text}>{selectedItem.description}</Text>
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
    color: '#fff',
  },
    contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'flex-start', // Keeps text left-aligned like Amazon
  },
  titleText: { 
    fontSize: 22,
    fontWeight: '600', 
    color: '#0f1111',        
     },
});
