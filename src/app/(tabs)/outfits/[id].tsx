import OutfitDetailPage from '@/components/outfitDetailPage';
import { MyOutfits_Data } from '@/constants/MyOutfitsData';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const outfitId = Array.isArray(id) ? id[0] : id;

  const outfit = MyOutfits_Data.find(item => item.outfit_id === outfitId);

  if (!outfit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Outfit not found.</Text>
      </View>
    );
  }

  return (
    <OutfitDetailPage
      outfit={{
        id: outfit.outfit_id,
        name: outfit.name,
        description: outfit.description,
        itemIds: outfit.item_ids,
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  notFoundText: {
    fontSize: 18,
    color: '#666',
  },
});
