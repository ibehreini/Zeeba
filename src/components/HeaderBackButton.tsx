import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

export default function HeaderBackButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
    </Pressable>
  );
}
