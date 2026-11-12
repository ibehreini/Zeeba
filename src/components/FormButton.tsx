import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type FormButtonProps = {
  title: string;
  onPress: () => void;
  /** 'secondary' is the quieter fill for Cancel-type actions. */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A 48pt-tall text button in the same style as TagEditor's primary button. */
export default function FormButton({ title, onPress, variant = 'primary', disabled = false, style }: FormButtonProps) {
  const { theme } = useTheme();
  const primary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      role="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.accent : theme.surfaceAlt },
        (pressed || disabled) && styles.dimmed,
        style,
      ]}
    >
      <Text style={[styles.text, { color: primary ? theme.onAccent : theme.textPrimary }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
  dimmed: {
    opacity: 0.6,
  },
});
