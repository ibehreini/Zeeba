import ClosetList from '@/components/ClosetList';
import { useDataMode } from '@/context/DataModeContext';
import { groupClosetItemsBySection, type ClosetSection } from '@/services/dataService.types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const router = useRouter();
  const { dataService } = useDataMode();
  const [sections, setSections] = useState<ClosetSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSections(null);
    setError(null);

    dataService
      .getClosetItems()
      .then(items => {
        if (!cancelled) setSections(groupClosetItemsBySection(items));
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load closet items.');
      });

    return () => {
      cancelled = true;
    };
  }, [dataService]);

  const handleNavigation = (id: string) => {
    router.push({
      pathname: '/closet/[id]', // This matches the filename src/app/closet/[id].tsx
      params: { id: id }         // This fills in the [id] part
    });
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!sections) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ClosetList
      items={sections}
      onItemPress={handleNavigation}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    paddingTop: 50,
  },
  title: {
    color: '#000',
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  button: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
    alignSelf: 'center',
    marginVertical: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#c00',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
