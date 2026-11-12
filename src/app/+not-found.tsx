import { View, StyleSheet, Text } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function NotFoundScreen() {
  const { theme } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text role="heading" style={[styles.text, { color: theme.textPrimary }]}>
          Oops, page not found
        </Text>
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
