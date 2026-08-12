import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { getErrorMessage, type ActivityLogEntry } from '@/services/dataService.types';
import { useFocusEffect, useIsFocused } from 'expo-router';
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
  // See src/app/(tabs)/index.tsx - the web tab view keeps inactive tabs
  // mounted (only hidden via zIndex/pointer-events), so NVDA still reads
  // this screen after navigating away unless we aria-hide it ourselves.
  const isFocused = useIsFocused();
  const { theme } = useTheme();
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
        <Text style={[styles.errorText, { color: theme.danger }]}>{closetError}</Text>
      </View>
    );
  } else if (!activeClosetId) {
    content = (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { color: theme.danger }]}>No closet found.</Text>
      </View>
    );
  } else if (error) {
    content = (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
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
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No activity yet.</Text>
      </View>
    );
  } else {
    content = (
      <ScrollView contentContainerStyle={styles.listPadding}>
        {entries.map(entry => (
          <View key={entry.id} style={styles.row}>
            <Text style={[styles.rowText, { color: theme.textPrimary }]}>{describeActivity(entry)}</Text>
            <Text style={[styles.rowTimestamp, { color: theme.textSecondary }]}>
              {new Date(entry.created_at).toLocaleString()}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container} aria-hidden={!isFocused}>
      {content}
    </View>
  );
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
  },
  rowTimestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
