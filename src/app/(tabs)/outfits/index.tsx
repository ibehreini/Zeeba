import OutfitsGrid from '@/components/OutfitsGrid';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const router = useRouter();

  const handleNavigation = (id: string) => {
    router.push({
      pathname: '/outfits/[id]',
      params: { id },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>My outfits screen</Text>
      <OutfitsGrid onOutfitPress={handleNavigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  text: {
    color: '#000',
  },
});
