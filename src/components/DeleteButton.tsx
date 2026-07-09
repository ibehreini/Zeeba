import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  isDeleting: boolean;
};

/** Destructive action button placed at the bottom of a detail page. */
export default function DeleteButton({ label, onPress, isDeleting }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isDeleting}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        isDeleting && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDeleting }}
    >
      {isDeleting ? <ActivityIndicator color="#c00" /> : <Text style={styles.text}>{label}</Text>}
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
    borderColor: '#c00',
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
    color: '#c00',
  },
});
