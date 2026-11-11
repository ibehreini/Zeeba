import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

/**
 * Settings, Settings > Edit tags and Settings > Logs. Same nested-stack
 * pattern as closet/ and outfits/, but the header deliberately stays neutral
 * in stylist mode instead of turning stylist blue: white on the stylist
 * colour is only about 2.1:1, and these screens are about the user's own
 * account and closet whichever closet the Home toggle points at.
 */
export default function SettingsLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.textPrimary,
      }}
    />
  );
}
