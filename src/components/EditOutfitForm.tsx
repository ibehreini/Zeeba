import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { ConflictError, getErrorMessage, type Outfit } from '@/services/dataService.types';
import { useToast } from '@/components/Toast';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { showAlert } from '@/utils/alert';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  outfitId: string;
};

export default function EditOutfitForm({ outfitId }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const { dataService } = useDataMode();
  const { showToast } = useToast();

  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const loadOutfit = useCallback(async () => {
    const fetchedOutfit = await dataService.getOutfitById(outfitId);
    setOutfit(fetchedOutfit);
    if (fetchedOutfit) {
      setName(fetchedOutfit.name);
      setDescription(fetchedOutfit.description ?? '');
    }
    return fetchedOutfit;
  }, [outfitId, dataService]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    loadOutfit()
      .catch(err => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load outfit.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadOutfit]);

  const canSubmit = !submitting && name.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!outfit || !name.trim() || !description.trim()) {
      showAlert('Missing information', 'Name and description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await dataService.updateOutfit(outfitId, outfit.updated_at, {
        name: name.trim(),
        description: description.trim(),
      });

      markOutfitsDirty();
      showToast('Outfit updated');
      router.dismissTo('/outfits');
    } catch (err) {
      if (err instanceof ConflictError) {
        await loadOutfit().catch(() => {});
        showAlert('Already changed', err.message);
      } else {
        showAlert('Couldn’t save changes', getErrorMessage(err, 'Something went wrong. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (loadError || !outfit) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>{loadError ?? 'Outfit not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <LabeledTextInput
        label="Name"
        required
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sunday Brunch"
        maxLength={100}
      />

      <LabeledTextInput
        label="Description"
        required
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the outfit"
        maxLength={1000}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: theme.accent },
          !canSubmit && { backgroundColor: theme.textSecondary },
          pressed && styles.submitButtonPressed,
        ]}
        role="button"
        aria-label="Save changes"
        aria-disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={[styles.submitButtonText, { color: theme.onAccent }]}>Save Changes</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  children: ReactNode;
};

function Field({ label, required, children }: FieldProps) {
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
  maxLength?: number;
};

function LabeledTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  maxLength,
}: LabeledTextInputProps) {
  const { theme } = useTheme();
  const themedInput = {
    backgroundColor: theme.surfaceAlt,
    borderColor: theme.border,
    color: theme.textPrimary,
  };
  return (
    <Field label={label} required={required}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : undefined}
        maxLength={maxLength}
        style={multiline ? [styles.textInput, themedInput, styles.multilineInput] : [styles.textInput, themedInput]}
        aria-label={required ? `${label}, required` : label}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  container: {
    padding: 20,
    paddingBottom: 48,
  },
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
  submitButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
