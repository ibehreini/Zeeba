import CreateOutfitForm from '@/components/CreateOutfitForm';
import RequireCloset from '@/components/RequireCloset';
import { Stack } from 'expo-router';

export default function NewOutfit() {
  return (
    <>
      <Stack.Screen options={{ title: 'Create A New Outfit' }} />
      <RequireCloset>
        <CreateOutfitForm />
      </RequireCloset>
    </>
  );
}
