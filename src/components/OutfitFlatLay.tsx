import React from 'react';
import { Image, ImageSourcePropType, ScrollView, StyleSheet, View } from 'react-native';

interface OutfitFlatLayProps {
  itemIds: string[];
  // Update the type to accept required local assets or network images
  itemImages: Record<string, ImageSourcePropType>; 
}

export default function OutfitFlatLay({
  itemIds,
  itemImages,
}: OutfitFlatLayProps) {
  const getGridColumns = (count: number) => {
    if (count <= 2) return 2;
    if (count <= 4) return 2;
    return 3;
  };

  const columns = getGridColumns(itemIds.length);

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.grid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {itemIds.map((itemId) => (
          <View
            key={itemId}
            style={[
              styles.itemContainer,
              {
                width: `${100 / columns}%`,
                aspectRatio: 1,
              },
            ]}
          >
            {/* FIX HERE: Pass the source directly without the { uri } wrapper */}
            <Image
              source={itemImages[itemId]}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ... keep your styles the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  grid: {
    padding: 8,
  },
  itemContainer: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
