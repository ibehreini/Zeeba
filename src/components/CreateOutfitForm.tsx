import { Field, LabeledTextInput } from '@/components/FormField';
import FormScreen from '@/components/FormScreen';
import OutfitTagPicker from '@/components/OutfitTagPicker';
import { useOutfitItemPicker } from '@/components/OutfitItemPicker';
import { useToast } from '@/components/Toast';
import { PendingVoiceNoteField } from '@/components/VoiceNotes';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { getErrorMessage, hasOutfitLabel, type PendingVoiceNote } from '@/services/dataService.types';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { showAlert } from '@/utils/alert';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

export default function CreateOutfitForm() {
  const { theme } = useTheme();
  const router = useRouter();
  const { dataService } = useDataMode();
  const { activeClosetId, activeClosetLabels, closetMode, refreshActiveClosetLabels } = useCloset();
  const { session } = useAuth();
  const { showToast } = useToast();
  const userId = session?.user.id ?? '';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pickedLabels, setPickedLabels] = useState<string[]>([]);
  const [voiceNote, setVoiceNote] = useState<PendingVoiceNote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const itemPicker = useOutfitItemPicker(activeClosetId);

  // Picks up tag edits made in Settings or by the closet owner on another
  // device while this form wasn't showing.
  useFocusEffect(
    useCallback(() => {
      refreshActiveClosetLabels();
    }, [refreshActiveClosetLabels]),
  );

  // A tag is required only when the closet has tags to choose from. The
  // effective picks are derived while rendering rather than pruned in an
  // effect: a tag removed in Settings drops out immediately, and comes back
  // still ticked if the removal is undone.
  const hasTags = activeClosetLabels.length > 0;
  const chosenLabels = pickedLabels.filter(picked => hasOutfitLabel(activeClosetLabels, picked));
  const tagsMissing = hasTags && chosenLabels.length === 0;

  const hasDescriptionOrVoiceNote = description.trim().length > 0 || !!voiceNote;
  // Save stays pressable while fields are missing (only dimmed), so pressing
  // it says what is still needed instead of being a silent "dimmed" button.
  const missing = [
    !name.trim() && 'a name',
    !hasDescriptionOrVoiceNote && 'a description or a voice note',
    tagsMissing && 'at least one tag',
    itemPicker.missing,
  ].filter(Boolean);

  const handleSubmit = async () => {
    if (!activeClosetId) {
      showAlert('No closet found', 'You need a closet before you can create an outfit.');
      return;
    }
    if (missing.length > 0) {
      showAlert('Missing information', `Still needed: ${missing.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    try {
      const created = await dataService.createOutfit({
        closetId: activeClosetId,
        userId,
        name: name.trim(),
        description: description.trim(),
        labels: chosenLabels,
        itemIds: itemPicker.selectedItemIds,
      });

      markOutfitsDirty();

      const openCreatedOutfit = () => {
        router.back();
        router.push({
          pathname: '/outfit/[id]',
          params: { id: created.outfit_id },
        });
      };

      // The outfit row has to exist before a note can point at it, so the
      // recording waits in local state until here. A failed upload must not
      // read as a failed create: the outfit is saved, so say so and move on.
      // That alert replaces the success toast, and navigation waits for it.
      if (voiceNote) {
        try {
          await dataService.addVoiceNote({ outfitId: created.outfit_id }, activeClosetId, voiceNote);
        } catch (err) {
          showAlert(
            'Outfit saved, but the voice note failed to upload',
            `${getErrorMessage(err, 'Something went wrong.')} You can record it again from the outfit’s page.`,
            [{ text: 'OK', onPress: openCreatedOutfit }],
          );
          return;
        }
      }

      // Toast before navigating, as the edit forms do: the provider sits
      // above the navigator, so the toast outlives this screen.
      showToast('Outfit created');
      openCreatedOutfit();
    } catch (err) {
      showAlert('Couldn’t create outfit', getErrorMessage(err, 'Something went wrong. Please try again.'));
      // A picked item may have just been deleted by someone else: reload the
      // items and drop picks that are gone, so Save can simply be pressed again.
      itemPicker.reloadItems();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // No bottom inset: this screen sits above the tab bar, which covers it.
    <FormScreen
      label="Save outfit"
      ariaLabel="Save outfit"
      onPress={handleSubmit}
      submitting={submitting}
      incomplete={missing.length > 0}
    >
      <LabeledTextInput
        label="Name"
        required
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sunday Brunch"
        maxLength={100}
      />

      <LabeledTextInput
        label="Description"
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the outfit, or record a voice note below"
        maxLength={1000}
      />

      <Field label="Voice note">
        <PendingVoiceNoteField value={voiceNote} onChange={setVoiceNote} disabled={submitting} />
      </Field>

      {/* Only once a closet is active: before that the list is empty because
          nothing has loaded, not because the closet has no tags. */}
      {activeClosetId && (
        <Field label="Tags" required={hasTags}>
          {hasTags ? (
            <OutfitTagPicker
              options={activeClosetLabels}
              value={chosenLabels}
              onChange={setPickedLabels}
              groupLabel="Tags, required, choose at least one"
            />
          ) : (
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>
              {closetMode === 'stylist'
                ? 'This closet has no tags, so this outfit will be saved without one. Only the closet’s owner can add tags.'
                : 'You have no tags, so this outfit will be saved without one. To add tags, go to Settings, then Edit tags.'}
            </Text>
          )}
        </Field>
      )}

      {itemPicker.field}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  errorText: {
    fontSize: 15,
  },
});
