import { useDataMode } from '@/context/DataModeContext';
import { getErrorMessage, toRNImageSource, type ClosetItem } from '@/services/dataService.types';
import { pickLibraryImages } from '@/utils/pickLibraryImages';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  itemId: string;
};

export default function EditClothingItemForm({ itemId }: Props) {
  const router = useRouter();
  const { dataService } = useDataMode();

  const [item, setItem] = useState<ClosetItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newPrimaryPhotoUri, setNewPrimaryPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fitNotes, setFitNotes] = useState('');
  const [careInstructions, setCareInstructions] = useState('');
  const [brand, setBrand] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    dataService
      .getClosetItemById(itemId)
      .then(fetchedItem => {
        if (cancelled) return;
        setItem(fetchedItem);
        if (fetchedItem) {
          setName(fetchedItem.name);
          setDescription(fetchedItem.description ?? '');
          setFitNotes(fetchedItem.fit_notes ?? '');
          setCareInstructions(fetchedItem.care_instructions ?? '');
          setBrand(fetchedItem.brand ?? '');
          setPurchaseUrl(fetchedItem.purchase_url ?? '');
        }
      })
      .catch(err => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load item.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId, dataService]);

  const handlePickPrimaryPhoto = async () => {
    const [uri] = await pickLibraryImages(false);
    if (uri) setNewPrimaryPhotoUri(uri);
  };

  const canSubmit = !submitting && name.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      Alert.alert('Missing information', 'Name and description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await dataService.updateClosetItem(itemId, {
        name: name.trim(),
        description: description.trim(),
        fitNotes: fitNotes.trim() || null,
        careInstructions: careInstructions.trim() || null,
        brand: brand.trim() || null,
        purchaseUrl: purchaseUrl.trim() || null,
        newPrimaryPhotoUri,
      });

      router.back();
      router.replace({ pathname: '/item/[id]', params: { id: itemId } });
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

  if (loadError || !item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? 'Item not found.'}</Text>
      </View>
    );
  }

  const previewSource = newPrimaryPhotoUri ? { uri: newPrimaryPhotoUri } : toRNImageSource(item.img);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Field label="Primary photo">
        <Pressable
          onPress={handlePickPrimaryPhoto}
          style={styles.primaryPhotoBox}
          accessibilityRole="button"
          accessibilityLabel="Change primary photo"
        >
          <Image source={previewSource} style={styles.primaryPhotoImage} />
        </Pressable>
      </Field>

      <LabeledTextInput
        label="Name"
        required
        value={name}
        onChangeText={setName}
        placeholder="e.g. Black Silk Tank"
      />

      <LabeledTextInput
        label="Description"
        required
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the item"
      />

      <LabeledTextInput
        label="Fit notes"
        value={fitNotes}
        onChangeText={setFitNotes}
        placeholder="e.g. Runs small"
      />

      <LabeledTextInput
        label="Care instructions"
        value={careInstructions}
        onChangeText={setCareInstructions}
        placeholder="e.g. Dry clean only"
      />

      <LabeledTextInput label="Brand" value={brand} onChangeText={setBrand} placeholder="e.g. Everlane" />

      <LabeledTextInput
        label="Purchase URL"
        value={purchaseUrl}
        onChangeText={setPurchaseUrl}
        placeholder="https://..."
        keyboardType="url"
        autoCapitalize="none"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [styles.submitButton, !canSubmit && styles.submitButtonDisabled, pressed && styles.submitButtonPressed]}
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
  keyboardType?: 'default' | 'url';
  autoCapitalize?: 'none' | 'sentences';
};

function LabeledTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  keyboardType,
  autoCapitalize,
}: LabeledTextInputProps) {
  return (
    <Field label={label} required={required}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={multiline ? 4 : undefined}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
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
  primaryPhotoBox: {
    width: 160,
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  primaryPhotoImage: {
    width: '100%',
    height: '100%',
  },
  primaryPhotoPlaceholder: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
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
