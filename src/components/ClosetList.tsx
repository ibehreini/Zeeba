import type { ClosetSection } from '@/constants/closetData';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import ClosetHeader from './ClosetHeader';
import ClosetRow from './ClosetRow';

type Props = {
  onItemPress: (id: string) => void;
  items: ClosetSection[];
};
export default function ClosetList({items, onItemPress}: Props) {
  

  return (
    <ScrollView contentContainerStyle={styles.listPadding}>
      {items.map((section) => (
        <View key={section.title} style={styles.section}>
          <ClosetHeader title={section.title} />
          <ClosetRow items={section.data} onItemPress={onItemPress} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listPadding: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
});