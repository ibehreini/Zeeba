import ErrorText from '@/components/ErrorText';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { getErrorMessage, type ActivityLogEntry } from '@/services/dataService.types';
import { announceForScreenReader } from '@/utils/announce';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const ITEM_TYPE_LABEL: Record<ActivityLogEntry['item_type'], string> = {
  outfit: 'outfit',
  clothing_item: 'item',
};

function describeActivity(entry: ActivityLogEntry): string {
  const actor = entry.actor_name ?? 'Someone';
  const itemLabel = ITEM_TYPE_LABEL[entry.item_type];
  return `${actor} ${entry.action_type} ${itemLabel} ${entry.item_name}`;
}

/** Entries plus the closet they belong to, so a closet switch never shows the previous closet's log. */
type LoadedLog = { closetId: string; entries: ActivityLogEntry[] };

/**
 * Settings > Logs (formerly the Logs tab at /about). Shows the active
 * closet's recent activity. No aria-hidden/isFocused handling here: unlike a
 * tab root, a stack screen that isn't on top is already hidden by the stack.
 */
export default function LogsScreen() {
  const { theme } = useTheme();
  const { dataService } = useDataMode();
  const {
    activeClosetId,
    activeClosetName,
    closetMode,
    isLoading: closetLoading,
    error: closetError,
  } = useCloset();

  const [log, setLog] = useState<LoadedLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refetches every time this screen regains focus, so activity from other
  // tabs (creating/editing/deleting an outfit or item) shows up on return.
  // The entries already on screen stay there until the new ones arrive
  // instead of flashing a spinner on every visit.
  useFocusEffect(
    useCallback(() => {
      if (!activeClosetId) return;

      let cancelled = false;
      setError(null);

      dataService
        .getActivityLog(activeClosetId)
        .then(result => {
          if (!cancelled) setLog({ closetId: activeClosetId, entries: result });
        })
        .catch(err => {
          if (cancelled) return;
          const message = getErrorMessage(err, 'Failed to load activity.');
          setError(message);
          announceForScreenReader(message);
        });

      return () => {
        cancelled = true;
      };
    }, [dataService, activeClosetId]),
  );

  const entries = log && log.closetId === activeClosetId ? log.entries : null;

  let content;
  if (closetLoading) {
    content = <LoadingIndicator label="Loading activity" />;
  } else if (closetError) {
    content = (
      <View style={styles.centered}>
        <ErrorText style={[styles.errorText, { color: theme.danger }]}>{closetError}</ErrorText>
      </View>
    );
  } else if (!activeClosetId) {
    content = (
      <View style={styles.centered}>
        <ErrorText style={[styles.errorText, { color: theme.danger }]}>
          {closetMode === 'stylist' ? 'You aren’t a stylist on any closets yet.' : 'No closet found.'}
        </ErrorText>
      </View>
    );
  } else if (error && !entries) {
    content = (
      <View style={styles.centered}>
        <Text role="alert" style={[styles.errorText, { color: theme.danger }]}>
          {error}
        </Text>
      </View>
    );
  } else if (!entries) {
    content = <LoadingIndicator label="Loading activity" />;
  } else if (entries.length === 0) {
    content = (
      <View style={styles.centered}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No activity yet.</Text>
      </View>
    );
  } else {
    content = (
      <ScrollView contentContainerStyle={styles.listPadding}>
        {activeClosetName && (
          <Text role="heading" aria-level={2} style={[styles.heading, { color: theme.textPrimary }]}>
            Recent activity in {activeClosetName}
          </Text>
        )}
        {/* A refresh failed but older entries are still worth showing. */}
        {error && (
          <Text role="alert" style={[styles.refreshError, { color: theme.danger }]}>
            {error}
          </Text>
        )}
        <View role="list" aria-label="Recent activity">
          {entries.map(entry => (
            // One Text per entry, so VoiceOver reads description and time
            // as a single stop instead of two.
            <View role="listitem" key={entry.id} style={styles.row}>
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>
                {describeActivity(entry)}
                {'\n'}
                <Text style={[styles.rowTimestamp, { color: theme.textSecondary }]}>
                  {new Date(entry.created_at).toLocaleString()}
                </Text>
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Logs' }} />
      <View style={styles.container}>{content}</View>
    </>
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
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  refreshError: {
    fontSize: 14,
    marginBottom: 12,
  },
  row: {
    marginBottom: 16,
  },
  rowText: {
    fontSize: 15,
  },
  rowTimestamp: {
    fontSize: 12,
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
