import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import ErrorText from '@/components/ErrorText';
import FormButton from '@/components/FormButton';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Shown wherever the user needs their own closet but hasn't made one yet
 * (the home tab, and the add-item and create-outfit screens via RequireCloset). Creating it updates ClosetContext,
 * so the caller re-renders with an active closet and this form disappears.
 */
export default function NewClosetForm({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  const { createOwnCloset } = useCloset();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createOwnCloset(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create closet.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]} role="heading" aria-level={2}>
        No closet yet - name one to get started
      </Text>
      <TextInput
        style={[styles.input, { borderColor: theme.controlBorder, color: theme.textPrimary }]}
        placeholderTextColor={theme.textSecondary}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ida's Closet"
        aria-label="Closet name"
        editable={!submitting}
        autoCapitalize="words"
      />
      {error && (
        <ErrorText style={[styles.errorText, { color: theme.danger }]}>{error}</ErrorText>
      )}
      {submitting ? (
        <LoadingIndicator label="Creating closet" />
      ) : (
        <FormButton title="Create closet" onPress={handleSubmit} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '85%',
    maxWidth: 560,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
  },
});
