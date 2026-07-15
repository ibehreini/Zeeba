import EditClothingItemForm from '@/components/EditClothingItemForm';
import HeaderBackButton from '@/components/HeaderBackButton';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Edit item', headerLeft: HeaderBackButton }} />
      <EditClothingItemForm itemId={id} />
    </>
  );
}
