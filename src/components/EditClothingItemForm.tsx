import { Field, LabeledTextInput } from '@/components/FormField';
import ErrorText from '@/components/ErrorText';
import FormSubmitFooter from '@/components/FormSubmitFooter';
import NativeSelect from '@/components/NativeSelect';
import RemoveBackgroundButton from '@/components/RemoveBackgroundButton';
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
import { pickPhoto } from '@/utils/pickPhoto';
import { isCutoutPhotoUrl } from '@/utils/removeBackground';
import { revokeIfBlobUrl } from '@/utils/revokeIfBlobUrl';
import { showAlert } from '@/utils/alert';
import { conflictMessage } from '@/utils/conflictMessage';
import { announceForScreenReader } from '@/utils/announce';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  // The background-removed version of the photo being shown (a newly picked
  // one, or the item's current photo), when the user asked for one.
  const [cutoutUri, setCutoutUri] = useState<string | null>(null);
  // On web the cutout is a blob: URL pinning the whole PNG in memory. It's
  // revoked when replaced or restored; this frees whatever is left when the
  // form closes (after a save, the upload has already read it).
  const cutoutUriRef = useRef(cutoutUri);
  cutoutUriRef.current = cutoutUri;
  useEffect(() => () => revokeIfBlobUrl(cutoutUriRef.current), []);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [itemType, setItemType] = useState<ClothingItemType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fitNotes, setFitNotes] = useState('');
  const [careInstructions, setCareInstructions] = useState('');
  const [brand, setBrand] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  // A description is optional once the item has a voice note (added from its page).
  const [hasVoiceNote, setHasVoiceNote] = useState(false);

  const loadItem = useCallback(async () => {
    const [fetchedItem, voiceNotes] = await Promise.all([
      dataService.getClosetItemById(itemId),
      dataService.getVoiceNotes({ clothingItemId: itemId }).catch(() => []),
    ]);
    setHasVoiceNote(voiceNotes.length > 0);
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
    const uri = await pickPhoto();
    if (!uri) return;
    // On web each pick mints a fresh object URL; free the one it replaces.
    if (uri !== newPrimaryPhotoUri) revokeIfBlobUrl(newPrimaryPhotoUri);
    setNewPrimaryPhotoUri(uri);
    // A cutout belongs to the photo it was made from.
    clearCutout();
  };

  const clearCutout = () => {
    revokeIfBlobUrl(cutoutUri);
    setCutoutUri(null);
  };

  const hasDescriptionOrVoiceNote = description.trim().length > 0 || hasVoiceNote;
  // Save stays pressable while fields are missing (only dimmed), so pressing
  // it says what is still needed instead of being a silent "dimmed" button.
  const missing = [
    !itemType && 'a type',
    !name.trim() && 'a name',
    !hasDescriptionOrVoiceNote && 'a description or a voice note',
  ].filter(Boolean);
  const isBusy = submitting || isRemovingBackground;
  const isRecategorizing = !!item && !!itemType && itemType !== item.item_type;

  // role="status" below is a live region on web only; iOS needs to be told.
  useEffect(() => {
    if (isRecategorizing) announceForScreenReader("This item stays in every outfit it's part of and will show there under its new type.");
  }, [isRecategorizing]);

  const handleSubmit = async () => {
    if (!item || !itemType || missing.length > 0) {
      showAlert('Missing information', `Still needed: ${missing.join(', ')}.`);
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
        // A cutout replaces the primary photo just like a newly picked one.
        newPrimaryPhotoUri: cutoutUri ?? newPrimaryPhotoUri,
        newPrimaryPhotoKeepTransparency: !!cutoutUri,
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
              ? conflictMessage(item, fresh, {
                  img: 'photo',
                  item_type: 'type',
                  name: 'name',
                  description: 'description',
                  fit_notes: 'fit notes',
                  care_instructions: 'care instructions',
                  brand: 'brand',
                  purchase_url: 'purchase URL',
                })
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
        <LoadingIndicator label="Loading item" />
      </View>
    );
  }

  if (loadError || !item) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ErrorText style={[styles.errorText, { color: theme.textSecondary }]}>{loadError ?? 'Item not found.'}</ErrorText>
      </View>
    );
  }

  const previewUri = cutoutUri ?? newPrimaryPhotoUri;
  const previewSource = previewUri ? { uri: previewUri } : toRNImageSource(item.img);
  const showingCutout = !!cutoutUri || (!newPrimaryPhotoUri && isCutoutPhotoUrl(item.img));
  // What "Remove background" would work on: the newly picked photo, else the
  // item's current photo - unless that one is already a cutout, or is a
  // bundled asset (preview mode) rather than a photo with a URL.
  const removableUri =
    newPrimaryPhotoUri ?? (typeof item.img === 'string' && !isCutoutPhotoUrl(item.img) ? item.img : null);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
        <Field label="Primary photo">
          <Pressable
            onPress={handlePickPrimaryPhoto}
            style={[styles.primaryPhotoBox, { borderColor: theme.border }]}
            role="button"
            aria-label={showingCutout ? 'Change primary photo. Background removed.' : 'Change primary photo'}
          >
            <Image
              source={previewSource}
              style={styles.primaryPhotoImage}
              // A cutout is trimmed tight to the garment, so "cover" would crop it.
              resizeMode={showingCutout ? 'contain' : 'cover'}
            />
          </Pressable>
          <RemoveBackgroundButton
            sourceUri={removableUri}
            isRemoved={!!cutoutUri}
            onRemoved={setCutoutUri}
            onRestore={clearCutout}
            onBusyChange={setIsRemovingBackground}
            disabled={submitting}
          />
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
          required={!hasVoiceNote}
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
      </ScrollView>

      {/* A stack screen outside the tabs, so nothing else covers the home indicator. */}
      <FormSubmitFooter
        label="Save Changes"
        ariaLabel="Save changes"
        onPress={handleSubmit}
        submitting={submitting}
        disabled={isBusy}
        incomplete={missing.length > 0}
        insetBottom
      />
    </View>
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
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 24,
  },
  helperText: {
    fontSize: 14,
    marginTop: 8,
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
});
