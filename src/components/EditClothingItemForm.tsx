import NativeSelect from '@/components/NativeSelect';
import VoiceNotesSection from '@/components/VoiceNotes';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  CLOTHING_ITEM_TYPE_LABELS,
  CLOTHING_ITEM_TYPES,
  ConflictError,
  getErrorMessage,
  toRNImageSource,
  type ClosetItem,
  type ClothingItemType,
} from '@/services/dataService.types';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { useToast } from '@/components/Toast';
import { pickLibraryImages } from '@/utils/pickLibraryImages';
import { revokeIfBlobUrl } from '@/utils/revokeIfBlobUrl';
import { showAlert } from '@/utils/alert';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
  const { theme } = useTheme();
  const router = useRouter();
  const { dataService } = useDataMode();
  const { showToast } = useToast();

  const [item, setItem] = useState<ClosetItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newPrimaryPhotoUri, setNewPrimaryPhotoUri] = useState<string | null>(null);
  const [itemType, setItemType] = useState<ClothingItemType | null>(null);
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
      setItemType(fetchedItem.item_type);
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
    if (!uri) return;
    // On web each pick mints a fresh object URL; free the one it replaces.
    if (uri !== newPrimaryPhotoUri) revokeIfBlobUrl(newPrimaryPhotoUri);
    setNewPrimaryPhotoUri(uri);
  };

  const canSubmit = !submitting && !!itemType && name.trim().length > 0 && description.trim().length > 0;
  const isRecategorizing = !!item && !!itemType && itemType !== item.item_type;

  const handleSubmit = async () => {
    if (!item || !itemType || !name.trim() || !description.trim()) {
      showAlert('Missing information', 'Type, name, and description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await dataService.updateClosetItem(itemId, item.updated_at, {
        itemType,
        name: name.trim(),
        description: description.trim(),
        fitNotes: fitNotes.trim() || null,
        careInstructions: careInstructions.trim() || null,
        brand: brand.trim() || null,
        purchaseUrl: purchaseUrl.trim() || null,
        newPrimaryPhotoUri,
      });

      // The outfits tab caches closet items alongside its outfits, and a new
      // type or photo changes where/how this item draws in every flat lay.
      markOutfitsDirty();
      showToast('Item updated');
      router.dismissTo('/closet');
    } catch (err) {
      if (err instanceof ConflictError) {
        // Refresh only the OCC baseline (updated_at) - deliberately NOT the
        // text fields or the picked photo, so the user's in-progress edits
        // survive the conflict and pressing Save again applies them against
        // the fresh token. Also self-heals a save whose response was lost to
        // a network drop: the retry hits a false conflict and then succeeds.
        try {
          const fresh = await dataService.getClosetItemById(itemId);
          setItem(fresh);
          showAlert(
            fresh ? 'Someone else saved changes' : 'Item deleted',
            fresh
              ? 'This item was changed while you were editing. Your edits are still in the form - review them and press Save Changes again to apply.'
              : 'This item was deleted while you were editing.',
          );
        } catch {
          showAlert('Couldn’t save changes', 'Please check your connection and try again.');
        }
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

  if (loadError || !item) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>{loadError ?? 'Item not found.'}</Text>
      </View>
    );
  }

  const previewSource = newPrimaryPhotoUri ? { uri: newPrimaryPhotoUri } : toRNImageSource(item.img);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
      <Field label="Primary photo">
        <Pressable
          onPress={handlePickPrimaryPhoto}
          style={[styles.primaryPhotoBox, { borderColor: theme.border }]}
          role="button"
          aria-label="Change primary photo"
        >
          <Image source={previewSource} style={styles.primaryPhotoImage} />
        </Pressable>
      </Field>

      <Field label="Type" required>
        <NativeSelect
          label="Type"
          options={CLOTHING_ITEM_TYPES}
          value={itemType}
          onChange={setItemType}
          placeholder="Select a type"
          formatLabel={value => CLOTHING_ITEM_TYPE_LABELS[value]}
          required
        />
        {/* A live region so a screen reader hears the consequence of the
            change at the moment it's made, without a modal interrupting. */}
        {isRecategorizing && (
          <Text role="status" style={[styles.helperText, { color: theme.textSecondary }]}>
            This item stays in every outfit it's part of and will show there under its new type.
          </Text>
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

      {/* Uploads as soon as a recording stops - independent of Save Changes,
          which only covers the fields above. */}
      <VoiceNotesSection target={{ clothingItemId: itemId }} closetId={item.closet_id} canRecord />

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [styles.submitButton, { backgroundColor: theme.accent }, !canSubmit && { backgroundColor: theme.textSecondary }, pressed && styles.submitButtonPressed]}
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
  helperText: {
    fontSize: 14,
    marginTop: 8,
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
