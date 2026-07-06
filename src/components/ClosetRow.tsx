import type { ClosetItem } from '@/services/dataService.types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import ClothingItem from './ClothingItem';

type Props = {
  items: ClosetItem[];
  onItemPress: (id: string) => void;
};

export default function ClosetRow({ items, onItemPress }: Props) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.item_id} style={styles.itemWrapper}>
          <ClothingItem
            source={item.img}
            accessibilityLabel={item.name}
            onPress={() => onItemPress(item.item_id)}
          />
        </View>
      ))}
      {items.length === 1 && <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap', // ✨ Key change: allows items to drop to the next line
    justifyContent: 'flex-start', // 'flex-start' often works better with wrap than space-between
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  itemWrapper: {
    // Force items to take up a percentage of the width (e.g., 2-column grid minus padding)
    width: '48%', 
    margin: '1%',
  },
  spacer: {
    flex: 1,
    margin: 5,
  },
});