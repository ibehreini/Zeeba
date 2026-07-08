import OutfitsGrid from '@/components/OutfitsGrid';
import { useCloset } from '@/context/ClosetContext';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const router = useRouter();
  const { closetMode, activeClosetId, isLoading, error } = useCloset();

  const handleNavigation = (id: string) => {
    router.push({
      pathname: '/outfits/[id]',
      params: { id },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!activeClosetId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {closetMode === 'stylist' ? "You aren't a stylist on any closets yet." : 'No closet found.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OutfitsGrid closetId={activeClosetId} onOutfitPress={handleNavigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
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
