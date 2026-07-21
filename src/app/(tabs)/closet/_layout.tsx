import { Stack } from 'expo-router';
import { useCloset } from '@/context/ClosetContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function ClosetLayout() {
  const { closetMode } = useCloset();
  const isStylist = closetMode === 'stylist';

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: isStylist ? '#38bdf8' : '#fff' },
        headerTintColor: isStylist ? '#fff' : '#25292e',
      }}
    />
  );
}
