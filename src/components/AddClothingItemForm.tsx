import { Field, LabeledTextInput } from '@/components/FormField';
import FormSubmitFooter from '@/components/FormSubmitFooter';
import NativeSelect from '@/components/NativeSelect';
import RemoveBackgroundButton from '@/components/RemoveBackgroundButton';
import { PendingVoiceNoteField } from '@/components/VoiceNotes';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';
import { useDataMode } from '@/context/DataModeContext';
import {
  CLOTHING_ITEM_TYPE_LABELS,
  CLOTHING_ITEM_TYPES,
  type PendingVoiceNote,
  getErrorMessage,
  type ClothingItemType,
  type NewClosetItemPhoto,
} from '@/services/dataService.types';
import { pickPhoto } from '@/utils/pickPhoto';
import { revokeIfBlobUrl } from '@/utils/revokeIfBlobUrl';
import { showAlert } from '@/utils/alert';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function AddClothingItemForm() {
  const { theme } = useTheme();
  const router = useRouter();
  const { dataService } = useDataMode();
  const { activeClosetId } = useCloset();

  const [primaryPhotoUri, setPrimaryPhotoUri] = useState<string | null>(null);
  // The background-removed version of primaryPhotoUri, when the user asked
  // for one. The original is kept so "Restore original photo" can undo it.
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
  const [fitNotes, setFitNotes] = useState<string | null>(null);
  const [careInstructions, setCareInstructions] = useState('');
  const [brand, setBrand] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [voiceNote, setVoiceNote] = useState<PendingVoiceNote | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const handlePickPrimaryPhoto = async () => {
    const uri = await pickPhoto();
    if (!uri) return;
    // On web each pick mints a fresh object URL; free the one it replaces.
    if (uri !== primaryPhotoUri) revokeIfBlobUrl(primaryPhotoUri);
    setPrimaryPhotoUri(uri);
    // A cutout belongs to the photo it was made from.
    clearCutout();
  };

  const clearCutout = () => {
    revokeIfBlobUrl(cutoutUri);
    setCutoutUri(null);
  };

  const displayedPhotoUri = cutoutUri ?? primaryPhotoUri;

  // Save stays pressable while fields are missing (only dimmed), so a
  // screen reader user who presses it hears exactly what is still needed
  // instead of meeting a silent "dimmed" button with no reason.
  const missing = [
    !primaryPhotoUri && 'a primary photo',
    !itemType && 'a type',
    !name.trim() && 'a name',
    !description.trim() && !voiceNote && 'a description or a voice note',
  ].filter(Boolean);
  const isBusy = submitting || isRemovingBackground;

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
        { uri: displayedPhotoUri, isPrimary: true, keepTransparency: !!cutoutUri },
      ];

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

      // Same pattern as CreateOutfitForm: the item row must exist before a
      // note can point at it, and a failed upload must not read as a failed
      // create.
      if (voiceNote) {
        try {
          await dataService.addVoiceNote({ clothingItemId: created.item_id }, activeClosetId, voiceNote);
        } catch (err) {
          showAlert(
            'Item saved, but the voice note failed to upload',
            `${getErrorMessage(err, 'Something went wrong.')} You can record it again from the item's edit screen.`,
          );
        }
      }

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
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
        <Field label="Primary photo" required>
          <Pressable
            onPress={handlePickPrimaryPhoto}
            style={[styles.primaryPhotoBox, { borderColor: theme.border }]}
            role="button"
            aria-label={
              !displayedPhotoUri
                ? 'Add primary photo, required'
                : cutoutUri
                  ? 'Change primary photo. Background removed.'
                  : 'Change primary photo'
            }
          >
            {displayedPhotoUri ? (
              <Image
                source={{ uri: displayedPhotoUri }}
                style={styles.primaryPhotoImage}
                // A cutout is trimmed tight to the garment, so "cover" would crop it.
                resizeMode={cutoutUri ? 'contain' : 'cover'}
              />
            ) : (
              <Text style={styles.primaryPhotoPlaceholder}>+ Add Photo</Text>
            )}
          </Pressable>
          <RemoveBackgroundButton
            sourceUri={primaryPhotoUri}
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
      </ScrollView>

      {/* No bottom inset: this screen sits above the tab bar, which covers it. */}
      <FormSubmitFooter
        label="Save Item"
        ariaLabel="Save item"
        onPress={handleSubmit}
        submitting={submitting}
        disabled={isBusy}
        incomplete={missing.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: '#666666', // 5.5:1 on #fafafa (#999 was 2.7:1)
  },
});
