import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type Props = {
  label: string;
  onPress: () => void;
  isDeleting: boolean;
};

/** Destructive action button placed at the bottom of a detail page. */
export default function DeleteButton({ label, onPress, isDeleting }: Props) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={isDeleting}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.danger },
        pressed && styles.buttonPressed,
        isDeleting && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDeleting }}
    >
      {isDeleting ? (
        <ActivityIndicator color={theme.danger} />
      ) : (
        <Text style={[styles.text, { color: theme.danger }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 32,
    minHeight: 50,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
});
