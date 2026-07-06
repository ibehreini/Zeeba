import ClothingItemDetail from '@/components/ClothingItemDetail';
import { useLocalSearchParams } from 'expo-router';

export default function Details() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ClothingItemDetail itemId={id} />;
}