import { useTheme } from '@/context/ThemeContext';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

type FieldProps = {
  label: string;
  required?: boolean;
  children: ReactNode;
};

/** A labelled form row; required fields get a red asterisk. */
export function Field({ label, required, children }: FieldProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
        {label}
        {required && <Text style={{ color: theme.danger }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

type LabeledTextInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'url';
  autoCapitalize?: 'none' | 'sentences';
  maxLength?: number;
};

/** A text input in a `Field`, named for screen readers (", required" when it is). */
export function LabeledTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  keyboardType,
  autoCapitalize,
  maxLength,
}: LabeledTextInputProps) {
  const { theme } = useTheme();
  const themedInput = { backgroundColor: theme.surfaceAlt, borderColor: theme.controlBorder, color: theme.textPrimary };
  return (
    <Field label={label} required={required}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : undefined}
        keyboardType={keyboardType}
        textContentType={keyboardType === 'url' ? 'URL' : undefined}
        autoCorrect={keyboardType === 'url' ? false : undefined}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        style={multiline ? [styles.textInput, themedInput, styles.multilineInput] : [styles.textInput, themedInput]}
        aria-label={required ? `${label}, required` : label}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
