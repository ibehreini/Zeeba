import AddClothingItemForm from '@/components/AddClothingItemForm';
import { Stack } from 'expo-router';

export default function NewClosetItem() {
  return (
    <>
      <Stack.Screen options={{ title: 'Add New Item' }} />
      <AddClothingItemForm />
    </>
  );
}
