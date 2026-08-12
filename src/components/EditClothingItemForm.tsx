import { useDataMode } from '@/context/DataModeContext';
import { ConflictError, getErrorMessage, toRNImageSource, type ClosetItem } from '@/services/dataService.types';
import { useToast } from '@/components/Toast';
import { pickLibraryImages } from '@/utils/pickLibraryImages';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
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
  const { showToast } = useToast();

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

  const loadItem = useCallback(async () => {
    const fetchedItem = await dataService.getClosetItemById(itemId);
    setItem(fetchedItem);
    if (fetchedItem) {
      setName(fetchedItem.name);
      setDescription(fetchedItem.description ?? '');
      setFitNotes(fetchedItem.fit_notes ?? '');
      setCareInstructions(fetchedItem.care_instructions ?? '');
      setBrand(fetchedItem.brand ?? '');
      setPurchaseUrl(fetchedItem.purchase_url ?? '');
    }
    return fetchedItem;
  }, [itemId, dataService]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    loadItem()
      .catch(err => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load item.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadItem]);

  const handlePickPrimaryPhoto = async () => {
    const [uri] = await pickLibraryImages(false);
    if (uri) setNewPrimaryPhotoUri(uri);
  };

  const canSubmit = !submitting && name.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!item || !name.trim() || !description.trim()) {
      Alert.alert('Missing information', 'Name and description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await dataService.updateClosetItem(itemId, item.updated_at, {
        name: name.trim(),
        description: description.trim(),
        fitNotes: fitNotes.trim() || null,
        careInstructions: careInstructions.trim() || null,
        brand: brand.trim() || null,
        purchaseUrl: purchaseUrl.trim() || null,
        newPrimaryPhotoUri,
      });

      showToast('Item updated');
      router.dismissTo('/closet');
    } catch (err) {
      if (err instanceof ConflictError) {
        setNewPrimaryPhotoUri(null);
        await loadItem().catch(() => {});
        Alert.alert('Already changed', err.message);
      } else {
        Alert.alert('Couldn’t save changes', getErrorMessage(err, 'Something went wrong. Please try again.'));
      }
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
        {Platform.OS === 'web' ? (
          <View style={styles.primaryPhotoBox}>
            <Image source={previewSource} style={styles.primaryPhotoImage} />
          </View>
        ) : (
          <Pressable
            onPress={handlePickPrimaryPhoto}
            style={styles.primaryPhotoBox}
            role="button"
            aria-label="Change primary photo"
          >
            <Image source={previewSource} style={styles.primaryPhotoImage} />
          </Pressable>
        )}
      </Field>

      <LabeledTextInput
        label="Name"
        required
        value={name}
        onChangeText={setName}
        placeholder="e.g. Black Silk Tank"
        maxLength={100}
      />

      <LabeledTextInput
        label="Description"
        required
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the item"
        maxLength={1000}
      />

      <LabeledTextInput
        label="Fit notes"
        value={fitNotes}
        onChangeText={setFitNotes}
        placeholder="e.g. Runs small"
        maxLength={500}
      />

      <LabeledTextInput
        label="Care instructions"
        value={careInstructions}
        onChangeText={setCareInstructions}
        placeholder="e.g. Dry clean only"
        maxLength={500}
      />

      <LabeledTextInput
        label="Brand"
        value={brand}
        onChangeText={setBrand}
        placeholder="e.g. Everlane"
        maxLength={100}
      />

      <LabeledTextInput
        label="Purchase URL"
        value={purchaseUrl}
        onChangeText={setPurchaseUrl}
        placeholder="https://..."
        keyboardType="url"
        autoCapitalize="none"
        maxLength={2048}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [styles.submitButton, !canSubmit && styles.submitButtonDisabled, pressed && styles.submitButtonPressed]}
        role="button"
        aria-label="Save changes"
        aria-disabled={!canSubmit}
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
  maxLength?: number;
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
  maxLength,
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
        maxLength={maxLength}
        style={multiline ? [styles.textInput, styles.multilineInput] : styles.textInput}
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
