import EditOutfitForm from '@/components/EditOutfitForm';
import HeaderBackButton from '@/components/HeaderBackButton';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function EditOutfit() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Edit outfit', headerLeft: HeaderBackButton }} />
      <EditOutfitForm outfitId={id} />
    </>
  );
}
