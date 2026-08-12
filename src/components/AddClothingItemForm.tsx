import NativeSelect from '@/components/NativeSelect';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';
import { useDataMode } from '@/context/DataModeContext';
import {
  CLOTHING_ITEM_TYPE_LABELS,
  CLOTHING_ITEM_TYPES,
  getErrorMessage,
  type ClothingItemType,
  type NewClosetItemPhoto,
} from '@/services/dataService.types';
import { pickLibraryImages } from '@/utils/pickLibraryImages';
import { showAlert } from '@/utils/alert';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function AddClothingItemForm() {
  const { theme } = useTheme();
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
      showAlert('No closet found', 'You need a closet before you can add items to it.');
      return;
    }
    if (!primaryPhotoUri || !itemType || !name.trim() || !description.trim()) {
      showAlert('Missing information', 'Type, name, description, and a primary photo are all required.');
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

      showAlert('Item added', `"${created.name}" was added to your closet.`, [
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
      showAlert('Couldn’t add item', getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
      <Field label="Primary photo" required>
        {/* Web-gated like EditClothingItemForm: photo upload runs through
            compressImage, whose web variant throws - without this gate the
            picker "worked" but every save silently failed and rolled back. */}
        {Platform.OS === 'web' ? (
          <View style={[styles.primaryPhotoBox, { borderColor: theme.border }]}>
            <Text style={styles.primaryPhotoPlaceholder}>
              Adding photos isn't supported on the web yet - please use the mobile app to add items.
            </Text>
          </View>
        ) : (
        <Pressable
          onPress={handlePickPrimaryPhoto}
          style={[styles.primaryPhotoBox, { borderColor: theme.border }]}
          role="button"
          aria-label={primaryPhotoUri ? 'Change primary photo' : 'Add primary photo, required'}
        >
          {primaryPhotoUri ? (
            <Image source={{ uri: primaryPhotoUri }} style={styles.primaryPhotoImage} />
          ) : (
            <Text style={styles.primaryPhotoPlaceholder}>+ Add Photo</Text>
          )}
        </Pressable>
        )}
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
        value={fitNotes ?? ''}
        onChangeText={text => setFitNotes(text || null)}
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
        style={({ pressed }) => [styles.submitButton, { backgroundColor: theme.accent }, !canSubmit && { backgroundColor: theme.textSecondary }, pressed && styles.submitButtonPressed]}
        role="button"
        aria-label="Save item"
        aria-disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={[styles.submitButtonText, { color: theme.onAccent }]}>Save Item</Text>
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
  const { theme } = useTheme();
  const themedInput = { backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.textPrimary };
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
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        style={multiline ? [styles.textInput, themedInput, styles.multilineInput] : [styles.textInput, themedInput]}
        aria-label={required ? `${label}, required` : label}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
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
  primaryPhotoBox: {
    width: 160,
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    // Photo wells stay light in both themes: the garment photos are shot on white, so a dark well would frame each one in a hard white box.
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
    // Sits on the hardcoded-light photo well, so it stays a fixed grey in both themes.
    color: '#999',
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
