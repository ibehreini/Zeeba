import { Field, LabeledTextInput } from '@/components/FormField';
import FormScreen, { FormErrorView, FormLoadingView } from '@/components/FormScreen';
import NativeSelect from '@/components/NativeSelect';
import PrimaryPhotoField, { usePrimaryPhoto } from '@/components/PrimaryPhotoField';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { useFormLoad } from '@/hooks/useFormLoad';
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
import { isCutoutPhotoUrl } from '@/utils/removeBackground';
import { showAlert } from '@/utils/alert';
import { handleSaveConflict } from '@/utils/conflictMessage';
import { announceForScreenReader } from '@/utils/announce';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

type Props = {
  itemId: string;
};

export default function EditClothingItemForm({ itemId }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const { dataService } = useDataMode();
  const { showToast } = useToast();

  const [item, setItem] = useState<ClosetItem | null>(null);

  // A newly picked photo, and the background-removed version of the photo
  // being shown (that one, or the item's current photo).
  const photo = usePrimaryPhoto();
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

  const { isLoading, loadError } = useFormLoad(loadItem, 'Failed to load item.');

  const hasDescriptionOrVoiceNote = description.trim().length > 0 || hasVoiceNote;
  // Save stays pressable while fields are missing (only dimmed), so pressing
  // it says what is still needed instead of being a silent "dimmed" button.
  const missing = [
    !itemType && 'a type',
    !name.trim() && 'a name',
    !hasDescriptionOrVoiceNote && 'a description or a voice note',
  ].filter(Boolean);
  const isBusy = submitting || photo.isRemovingBackground;
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
        newPrimaryPhotoUri: photo.cutoutUri ?? photo.pickedUri,
        newPrimaryPhotoKeepTransparency: !!photo.cutoutUri,
      });

      // The outfits tab caches closet items alongside its outfits, and a new
      // type or photo changes where/how this item draws in every flat lay.
      markOutfitsDirty();
      showToast('Item updated');
      router.dismissTo('/closet');
    } catch (err) {
      if (err instanceof ConflictError) {
        await handleSaveConflict({
          before: item,
          fetchFresh: () => dataService.getClosetItemById(itemId),
          setFresh: setItem,
          fieldLabels: {
            img: 'photo',
            item_type: 'type',
            name: 'name',
            description: 'description',
            fit_notes: 'fit notes',
            care_instructions: 'care instructions',
            brand: 'brand',
            purchase_url: 'purchase URL',
          },
          noun: 'item',
        });
      } else {
        showAlert('Couldn’t save changes', getErrorMessage(err, 'Something went wrong. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <FormLoadingView label="Loading item" />;

  if (loadError || !item) return <FormErrorView message={loadError ?? 'Item not found.'} />;

  const previewUri = photo.cutoutUri ?? photo.pickedUri;
  const previewSource = previewUri ? { uri: previewUri } : toRNImageSource(item.img);
  const showingCutout = !!photo.cutoutUri || (!photo.pickedUri && isCutoutPhotoUrl(item.img));
  // What "Remove background" would work on: the newly picked photo, else the
  // item's current photo - unless that one is already a cutout, or is a
  // bundled asset (preview mode) rather than a photo with a URL.
  const removableUri =
    photo.pickedUri ?? (typeof item.img === 'string' && !isCutoutPhotoUrl(item.img) ? item.img : null);

  return (
    // A stack screen outside the tabs, so nothing else covers the home indicator.
    <FormScreen
      label="Save changes"
      ariaLabel="Save changes"
      onPress={handleSubmit}
      submitting={submitting}
      disabled={isBusy}
      incomplete={missing.length > 0}
      insetBottom
    >
      <PrimaryPhotoField
        photo={photo}
        source={previewSource}
        showingCutout={showingCutout}
        removableUri={removableUri}
        disabled={submitting}
      />

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
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    fontSize: 14,
    marginTop: 8,
  },
});
