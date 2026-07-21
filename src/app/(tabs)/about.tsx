import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { getErrorMessage, type ActivityLogEntry } from '@/services/dataService.types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

const ITEM_TYPE_LABEL: Record<ActivityLogEntry['item_type'], string> = {
  outfit: 'outfit',
  clothing_item: 'item',
};

function describeActivity(entry: ActivityLogEntry): string {
  const actor = entry.actor_name ?? 'Someone';
  const itemLabel = ITEM_TYPE_LABEL[entry.item_type];
  return `${actor} ${entry.action_type} ${itemLabel} ${entry.item_name}`;
}

export default function AboutScreen() {
  const { dataService } = useDataMode();
  const { activeClosetId, isLoading: closetLoading, error: closetError } = useCloset();

  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refetches every time this tab regains focus, so activity from other tabs
  // (creating/editing/deleting an outfit or item) shows up on return.
  useFocusEffect(
    useCallback(() => {
      if (!activeClosetId) return;

      let cancelled = false;
      setEntries(null);
      setError(null);

      dataService
        .getActivityLog(activeClosetId)
        .then(result => {
          if (!cancelled) setEntries(result);
        })
        .catch(err => {
          if (!cancelled) setError(getErrorMessage(err, 'Failed to load activity.'));
        });

      return () => {
        cancelled = true;
      };
    }, [dataService, activeClosetId]),
  );

  let content;
  if (closetLoading) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  } else if (closetError) {
    content = (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{closetError}</Text>
      </View>
    );
  } else if (!activeClosetId) {
    content = (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No closet found.</Text>
      </View>
    );
  } else if (error) {
    content = (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  } else if (!entries) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  } else if (entries.length === 0) {
    content = (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No activity yet.</Text>
      </View>
    );
  } else {
    content = (
      <ScrollView contentContainerStyle={styles.listPadding}>
        {entries.map(entry => (
          <View key={entry.id} style={styles.row}>
            <Text style={styles.rowText}>{describeActivity(entry)}</Text>
            <Text style={styles.rowTimestamp}>{new Date(entry.created_at).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listPadding: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  row: {
    marginBottom: 16,
  },
  rowText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  rowTimestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  errorText: {
    color: '#c00',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
  },
});
