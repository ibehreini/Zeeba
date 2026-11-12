import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Shown wherever the user needs their own closet but hasn't made one yet
 * (the home tab, and the add-item screen). Creating it updates ClosetContext,
 * so the caller re-renders with an active closet and this form disappears.
 */
export default function NewClosetForm() {
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
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]} role="heading">
        No closet yet - name one to get started
      </Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
        placeholderTextColor={theme.textSecondary}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ida's Closet"
        aria-label="Closet name"
        editable={!submitting}
        autoCapitalize="words"
      />
      {error && (
        <Text style={[styles.errorText, { color: theme.danger }]} role="alert">
          {error}
        </Text>
      )}
      {submitting ? (
        <ActivityIndicator aria-label="Creating closet" />
      ) : (
        <Button title="Create closet" onPress={handleSubmit} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '85%',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 14,
  },
});
