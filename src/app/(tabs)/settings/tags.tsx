import TagEditor from '@/components/TagEditor';
import { Stack } from 'expo-router';

export default function EditTagsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Edit tags' }} />
      <TagEditor />
    </>
  );
}
