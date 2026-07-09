import CreateOutfitForm from '@/components/CreateOutfitForm';
import { Stack } from 'expo-router';

export default function NewOutfit() {
  return (
    <>
      <Stack.Screen options={{ title: 'Create A New Outfit' }} />
      <CreateOutfitForm />
    </>
  );
}
