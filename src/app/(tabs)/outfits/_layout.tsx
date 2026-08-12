import { Stack } from 'expo-router';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function OutfitsLayout() {
  const { closetMode } = useCloset();
  const { theme } = useTheme();
  const isStylist = closetMode === 'stylist';

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: isStylist ? theme.stylist : theme.surface },
        headerTintColor: isStylist ? theme.onStylist : theme.textPrimary,
      }}
    />
  );
}
