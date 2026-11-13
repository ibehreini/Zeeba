import { Field, LabeledTextInput } from '@/components/FormField';
import FormScreen from '@/components/FormScreen';
import NativeSelect from '@/components/NativeSelect';
import PrimaryPhotoField, { usePrimaryPhoto } from '@/components/PrimaryPhotoField';
import { useToast } from '@/components/Toast';
import { PendingVoiceNoteField } from '@/components/VoiceNotes';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import {
  CLOTHING_ITEM_TYPE_LABELS,
  CLOTHING_ITEM_TYPES,
  type PendingVoiceNote,
  getErrorMessage,
  type ClothingItemType,
  type NewClosetItemPhoto,
} from '@/services/dataService.types';
import { showAlert } from '@/utils/alert';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function AddClothingItemForm() {
  const router = useRouter();
  const { dataService } = useDataMode();
  const { activeClosetId } = useCloset();
  const { showToast } = useToast();

  // The picked photo, and its background-removed version when asked for.
  const photo = usePrimaryPhoto();

  const [itemType, setItemType] = useState<ClothingItemType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fitNotes, setFitNotes] = useState<string | null>(null);
  const [careInstructions, setCareInstructions] = useState('');
  const [brand, setBrand] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [voiceNote, setVoiceNote] = useState<PendingVoiceNote | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const displayedPhotoUri = photo.cutoutUri ?? photo.pickedUri;

  // Save stays pressable while fields are missing (only dimmed), so a
  // screen reader user who presses it hears exactly what is still needed
  // instead of meeting a silent "dimmed" button with no reason.
  const missing = [
    !photo.pickedUri && 'a primary photo',
    !itemType && 'a type',
    !name.trim() && 'a name',
    !description.trim() && !voiceNote && 'a description or a voice note',
  ].filter(Boolean);
  const isBusy = submitting || photo.isRemovingBackground;

  const handleSubmit = async () => {
    if (!activeClosetId) {
      showAlert('No closet found', 'You need a closet before you can add items to it.');
      return;
    }
    if (!displayedPhotoUri || !itemType || missing.length > 0) {
      showAlert('Missing information', `Still needed: ${missing.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    try {
      const photos: NewClosetItemPhoto[] = [
        { uri: displayedPhotoUri, isPrimary: true, keepTransparency: !!photo.cutoutUri },
      ];

      const created = await dataService.createClosetItem({
        closetId: activeClosetId,
        itemType,
        name: name.trim(),
        description: description.trim(),
        fitNotes: fitNotes?.trim() || null,
        careInstructions: careInstructions.trim() || null,
        brand: brand.trim() || null,
        purchaseUrl: purchaseUrl.trim() || null,
        photos,
      });

      const openCreatedItem = () => {
        router.back();
        router.push({
          pathname: '/item/[id]',
          params: { id: created.item_id },
        });
      };

      // Same pattern as CreateOutfitForm: the item row must exist before a
      // note can point at it, and a failed upload must not read as a failed
      // create. That alert already says the item was saved, so it replaces
      // the success toast, and navigation waits until it is dismissed.
      if (voiceNote) {
        try {
          await dataService.addVoiceNote({ clothingItemId: created.item_id }, activeClosetId, voiceNote);
        } catch (err) {
          showAlert(
            'Item saved, but the voice note failed to upload',
            `${getErrorMessage(err, 'Something went wrong.')} You can record it again from the item’s page.`,
            [{ text: 'OK', onPress: openCreatedItem }],
          );
          return;
        }
      }

      // Toast before navigating, as the edit forms do: the provider sits
      // above the navigator, so the toast outlives this screen.
      showToast('Item added');
      openCreatedItem();
    } catch (err) {
      showAlert('Couldn’t add item', getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // No bottom inset: this screen sits above the tab bar, which covers it.
    <FormScreen
      label="Save item"
      ariaLabel="Save item"
      onPress={handleSubmit}
      submitting={submitting}
      disabled={isBusy}
      incomplete={missing.length > 0}
    >
      <PrimaryPhotoField
        photo={photo}
        source={displayedPhotoUri ? { uri: displayedPhotoUri } : null}
        showingCutout={!!photo.cutoutUri}
        removableUri={photo.pickedUri}
        required
        disabled={submitting}
      />

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
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the item, or record a voice note below"
        maxLength={1000}
      />

      <Field label="Voice note">
        <PendingVoiceNoteField value={voiceNote} onChange={setVoiceNote} disabled={submitting} />
      </Field>

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
    </FormScreen>
  );
}
