import NativeSelect from '@/components/NativeSelect';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import {
  CLOTHING_ITEM_TYPE_LABELS,
  CLOTHING_ITEM_TYPES,
  getErrorMessage,
  type ClothingItemType,
  type NewClosetItemPhoto,
} from '@/services/dataService.types';
import { pickLibraryImages } from '@/utils/pickLibraryImages';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
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

export default function AddClothingItemForm() {
  const router = useRouter();
  const { dataService } = useDataMode();
  const { activeClosetId } = useCloset();

  const [primaryPhotoUri, setPrimaryPhotoUri] = useState<string | null>(null);

  const [itemType, setItemType] = useState<ClothingItemType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fitNotes, setFitNotes] = useState<string | null>(null);
  const [careInstructions, setCareInstructions] = useState('');
  const [brand, setBrand] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const handlePickPrimaryPhoto = async () => {
    const [uri] = await pickLibraryImages(false);
    if (uri) setPrimaryPhotoUri(uri);
  };

  const canSubmit =
    !submitting && !!primaryPhotoUri && !!itemType && name.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!activeClosetId) {
      Alert.alert('No closet found', 'You need a closet before you can add items to it.');
      return;
    }
    if (!primaryPhotoUri || !itemType || !name.trim() || !description.trim()) {
      Alert.alert('Missing information', 'Type, name, description, and a primary photo are all required.');
      return;
    }

    setSubmitting(true);
    try {
      const photos: NewClosetItemPhoto[] = [{ uri: primaryPhotoUri, isPrimary: true }];

      const created = await dataService.createClosetItem({
        closetId: activeClosetId,
        itemType,
        name: name.trim(),
        description: description.trim(),
        fitNotes,
        careInstructions: careInstructions.trim() || null,
        brand: brand.trim() || null,
        purchaseUrl: purchaseUrl.trim() || null,
        photos,
      });

      Alert.alert('Item added', `"${created.name}" was added to your closet.`, [
        {
          text: 'OK',
          onPress: () => {
            router.back();
            router.push({
              pathname: '/item/[id]',
              params: { id: created.item_id },
            });
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Couldn’t add item', getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Field label="Primary photo" required>
        <Pressable
          onPress={handlePickPrimaryPhoto}
          style={styles.primaryPhotoBox}
          accessibilityRole="button"
          accessibilityLabel={primaryPhotoUri ? 'Change primary photo' : 'Add primary photo, required'}
        >
          {primaryPhotoUri ? (
            <Image source={{ uri: primaryPhotoUri }} style={styles.primaryPhotoImage} />
          ) : (
            <Text style={styles.primaryPhotoPlaceholder}>+ Add Photo</Text>
          )}
        </Pressable>
      </Field>

      <Field label="Type" required>
        <NativeSelect
          label="Type"
          options={CLOTHING_ITEM_TYPES}
          value={itemType}
          onChange={value => setItemType(value)}
          placeholder="Select a type"
          formatLabel={value => CLOTHING_ITEM_TYPE_LABELS[value]}
          required
        />
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
        value={fitNotes ?? ''}
        onChangeText={text => setFitNotes(text || null)}
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
        accessibilityLabel="Save item"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Save Item</Text>
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
