import { useTheme } from '@/context/ThemeContext';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
};

export default function ClosetHeader({ title }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text accessibilityRole="header" style={[styles.headerText, { color: theme.textPrimary }]}>{title}</Text>
      <View style={[styles.underline, { backgroundColor: theme.textPrimary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  underline: {
    height: 2,
    width: 30,
    marginTop: 4,
    borderRadius: 1,
  },
});