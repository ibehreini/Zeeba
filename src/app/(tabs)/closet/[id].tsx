import ClothingItemDetail from '@/components/ClothingItemDetail';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Details() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <ClothingItemDetail itemId={id} />
      <Text accessibilityRole="header" style={styles.heading}>Worn in the Wild</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // Centers vertically
    alignItems: 'center',     // Centers horizontally
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,            // Space between image and text
    color: '#333',
  },
});