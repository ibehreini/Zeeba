import ErrorText from '@/components/ErrorText';
import { useTheme } from '@/context/ThemeContext';
import { StyleSheet, View } from 'react-native';

/** A tab screen's full-screen error, centred in the space the content would fill. */
export default function CenteredError({ message }: { message: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.centered}>
      <ErrorText style={[styles.errorText, { color: theme.danger }]}>{message}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
