import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function HeaderBackButton() {
  const router = useRouter();
  const { theme } = useTheme();

  // With no back stack (page reload, shared URL, deep link) back() is a
  // silent no-op, leaving a chevron that does nothing - fall back to Home.
  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={10}
    >
      <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
    </Pressable>
  );
}
