import AddClothingItemForm from '@/components/AddClothingItemForm';
import RequireCloset from '@/components/RequireCloset';
import { Stack } from 'expo-router';

export default function NewClosetItem() {
  return (
    <>
      <Stack.Screen options={{ title: 'Add item' }} />
      <RequireCloset>
        <AddClothingItemForm />
      </RequireCloset>
    </>
  );
}
