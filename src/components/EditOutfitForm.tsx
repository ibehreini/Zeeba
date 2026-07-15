import { useDataMode } from '@/context/DataModeContext';
import { getErrorMessage, type Outfit } from '@/services/dataService.types';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  outfitId: string;
};

export default function EditOutfitForm({ outfitId }: Props) {
  const router = useRouter();
  const { dataService } = useDataMode();

  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    dataService
      .getOutfitById(outfitId)
      .then(fetchedOutfit => {
        if (cancelled) return;
        setOutfit(fetchedOutfit);
        if (fetchedOutfit) {
          setName(fetchedOutfit.name);
          setDescription(fetchedOutfit.description ?? '');
        }
      })
      .catch(err => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load outfit.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [outfitId, dataService]);

  const canSubmit = !submitting && name.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      Alert.alert('Missing information', 'Name and description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await dataService.updateOutfit(outfitId, {
        name: name.trim(),
        description: description.trim(),
      });

      markOutfitsDirty();
      router.back();
      router.replace({ pathname: '/outfit/[id]', params: { id: outfitId } });
    } catch (err) {
      Alert.alert('Couldn’t save changes', getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (loadError || !outfit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? 'Outfit not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <LabeledTextInput
        label="Name"
        required
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sunday Brunch"
      />

      <LabeledTextInput
        label="Description"
        required
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the outfit"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitButton,
          !canSubmit && styles.submitButtonDisabled,
          pressed && styles.submitButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Save Changes</Text>
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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.requiredMark}> *</Text>}
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
};

function LabeledTextInput({ label, value, onChangeText, placeholder, required, multiline }: LabeledTextInputProps) {
  return (
    <Field label={label} required={required}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={multiline ? 4 : undefined}
        style={multiline ? [styles.textInput, styles.multilineInput] : styles.textInput}
        accessibilityLabel={required ? `${label}, required` : label}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  container: {
    padding: 20,
    paddingBottom: 48,
    backgroundColor: '#fff',
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  requiredMark: {
    color: '#c00',
  },
  textInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    backgroundColor: '#bbb',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
