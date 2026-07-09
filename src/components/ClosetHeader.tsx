import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
};

export default function ClosetHeader({ title }: Props) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.headerText}>{title}</Text>
      <View style={styles.underline} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    backgroundColor: '#fff', // Keeps it clean against the list background
  },
  headerText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  underline: {
    height: 2,
    width: 30,
    backgroundColor: '#000',
    marginTop: 4,
    borderRadius: 1,
  },
});