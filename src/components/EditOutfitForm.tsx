import { Field, LabeledTextInput } from '@/components/FormField';
import FormScreen, { FormErrorView, FormLoadingView } from '@/components/FormScreen';
import OutfitTagPicker from '@/components/OutfitTagPicker';
import { useOutfitItemPicker } from '@/components/OutfitItemPicker';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { useFormLoad } from '@/hooks/useFormLoad';
import { ConflictError, getErrorMessage, type Outfit } from '@/services/dataService.types';
import { useToast } from '@/components/Toast';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { showAlert } from '@/utils/alert';
import { handleSaveConflict } from '@/utils/conflictMessage';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

type Props = {
  outfitId: string;
};

export default function EditOutfitForm({ outfitId }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const { dataService } = useDataMode();
  const { showToast } = useToast();

  const [outfit, setOutfit] = useState<Outfit | null>(null);

  const { applyClosetLabels, startLabelsRequest } = useCloset();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  // The tags of the outfit's own closet (not necessarily the active one - an
  // outfit link can be opened from anywhere). null if they couldn't be read.
  const [closetLabels, setClosetLabels] = useState<string[] | null>(null);

  const [submitting, setSubmitting] = useState(false);
  // Items come from the outfit's own closet, which for a stylist or an
  // outfit link may not be the active one.
  const itemPicker = useOutfitItemPicker(outfit?.closet_id ?? null);
  const { setSelectedItemIds } = itemPicker;
  // A description is optional once the outfit has a voice note (added from its page).
  const [hasVoiceNote, setHasVoiceNote] = useState(false);

  const loadOutfit = useCallback(async () => {
    const [fetchedOutfit, voiceNotes] = await Promise.all([
      dataService.getOutfitById(outfitId),
      dataService.getVoiceNotes({ outfitId }).catch(() => []),
    ]);
    setHasVoiceNote(voiceNotes.length > 0);
    setOutfit(fetchedOutfit);
    if (fetchedOutfit) {
      setName(fetchedOutfit.name);
      setDescription(fetchedOutfit.description ?? '');
      setLabels(fetchedOutfit.labels);
      setSelectedItemIds(fetchedOutfit.item_ids);

      const ticket = startLabelsRequest();
      try {
        const fetchedLabels = await dataService.getClosetOutfitLabels(fetchedOutfit.closet_id);
        setClosetLabels(fetchedLabels);
        applyClosetLabels(fetchedOutfit.closet_id, fetchedLabels, ticket);
      } catch {
        // The outfit itself loaded, so the form stays usable: the picker
        // falls back to the tags the outfit already has (see below).
        setClosetLabels(null);
      }
    }
    return fetchedOutfit;
  }, [outfitId, dataService, applyClosetLabels, startLabelsRequest, setSelectedItemIds]);

  const { isLoading, loadError } = useFormLoad(loadOutfit, 'Failed to load outfit.');

  const hasDescriptionOrVoiceNote = description.trim().length > 0 || hasVoiceNote;
  // Save stays pressable while fields are missing (only dimmed), so pressing
  // it says what is still needed instead of being a silent "dimmed" button.
  const missing = [
    !name.trim() && 'a name',
    !hasDescriptionOrVoiceNote && 'a description or a voice note',
    itemPicker.missing,
  ].filter(Boolean);

  const handleSubmit = async () => {
    if (!outfit || missing.length > 0) {
      showAlert('Missing information', `Still needed: ${missing.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    try {
      await dataService.updateOutfit(outfitId, outfit.updated_at, {
        name: name.trim(),
        description: description.trim(),
        labels,
        itemIds: itemPicker.selectedItemIds,
      });

      markOutfitsDirty();
      showToast('Outfit updated');
      router.dismissTo('/outfits');
    } catch (err) {
      if (err instanceof ConflictError) {
        await handleSaveConflict({
          before: outfit,
          fetchFresh: () => dataService.getOutfitById(outfitId),
          setFresh: setOutfit,
          fieldLabels: { name: 'name', description: 'description', labels: 'tags', item_ids: 'items' },
          noun: 'outfit',
        });
      } else {
        showAlert('Couldn’t save changes', getErrorMessage(err, 'Something went wrong. Please try again.'));
        // A picked item may have just been deleted by someone else: drop it
        // from the picks, so Save can simply be pressed again.
        itemPicker.reloadItems();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <FormLoadingView label="Loading outfit" />;

  if (loadError || !outfit) return <FormErrorView message={loadError ?? 'Outfit not found.'} />;

  return (
    // A stack screen outside the tabs, so nothing else covers the home indicator.
    <FormScreen
      label="Save changes"
      ariaLabel="Save changes"
      onPress={handleSubmit}
      submitting={submitting}
      incomplete={missing.length > 0}
      insetBottom
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
        required={!hasVoiceNote}
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the outfit"
        maxLength={1000}
      />

      {/* Optional here even though Create outfit asks for one: an edit
          shouldn't be blocked by a rule the outfit may predate (one saved
          while the closet had no tags). Saved with Save changes. */}
      <Field label="Tags">
        {closetLabels === null ? (
          <Text style={[styles.hintText, { color: theme.textSecondary }]}>
            Couldn’t load this closet’s tags. You can still untick the tags this outfit already has.
          </Text>
        ) : closetLabels.length === 0 && labels.length === 0 ? (
          <Text style={[styles.hintText, { color: theme.textSecondary }]}>
            This closet has no tags yet. The closet’s owner can add them in Settings, then Edit tags.
          </Text>
        ) : null}
        <OutfitTagPicker
          options={closetLabels ?? outfit.labels}
          value={labels}
          onChange={setLabels}
          groupLabel="Tags"
        />
      </Field>

      {itemPicker.field}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  hintText: {
    fontSize: 15,
    marginBottom: 8,
  },
});
