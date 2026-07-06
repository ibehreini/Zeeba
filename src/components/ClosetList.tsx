import type { ClosetSection } from '@/services/dataService.types';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ClosetHeader from './ClosetHeader';
import ClosetRow from './ClosetRow';

type Props = {
  onItemPress: (id: string) => void;
  items: ClosetSection[];
};

export default function ClosetList({ items, onItemPress }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.listPadding}>
        {items.length > 0 ? (
          items.map(section => (
            <View key={section.title} style={styles.section}>
              <ClosetHeader title={section.title} />
              <ClosetRow items={section.data} onItemPress={onItemPress} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No clothing items yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listPadding: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
  },
});
