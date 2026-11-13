import CreateOutfitForm from '@/components/CreateOutfitForm';
import RequireCloset from '@/components/RequireCloset';
import { Stack } from 'expo-router';

export default function NewOutfit() {
  return (
    <>
      <Stack.Screen options={{ title: 'New outfit' }} />
      <RequireCloset>
        <CreateOutfitForm />
      </RequireCloset>
    </>
  );
}
