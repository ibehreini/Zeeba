import { View, StyleSheet, Text } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function NotFoundScreen() {
  const { theme } = useTheme();
  return (
    <>
      {/* The header title is the page's heading (an h1 on web), so the body
          explains instead of repeating it. */}
      <Stack.Screen options={{ title: 'Page not found' }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.textPrimary }]}>This page doesn’t exist or has moved.</Text>
        <Link href="/" style={[styles.link, { color: theme.link }]}>
          Go to Home
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 20,
  },
  link: {
    fontSize: 17,
    textDecorationLine: 'underline',
    padding: 12,
  },
});
