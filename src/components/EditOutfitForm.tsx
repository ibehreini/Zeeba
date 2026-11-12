import OutfitTagPicker from '@/components/OutfitTagPicker';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { ConflictError, getErrorMessage, type Outfit } from '@/services/dataService.types';
import { useToast } from '@/components/Toast';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { showAlert } from '@/utils/alert';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  outfitId: string;
};

export default function EditOutfitForm({ outfitId }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const { dataService } = useDataMode();
  const { showToast } = useToast();

  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { applyClosetLabels, startLabelsRequest } = useCloset();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  // The tags of the outfit's own closet (not necessarily the active one - an
  // outfit link can be opened from anywhere). null if they couldn't be read.
  const [closetLabels, setClosetLabels] = useState<string[] | null>(null);

  const [submitting, setSubmitting] = useState(false);
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
  }, [outfitId, dataService, applyClosetLabels, startLabelsRequest]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    loadOutfit()
      .catch(err => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load outfit.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadOutfit]);

  const hasDescriptionOrVoiceNote = description.trim().length > 0 || hasVoiceNote;
  const canSubmit = !submitting && name.trim().length > 0 && hasDescriptionOrVoiceNote;

  const handleSubmit = async () => {
    if (!outfit || !name.trim() || !hasDescriptionOrVoiceNote) {
      showAlert('Missing information', 'A name is required, plus a description or a voice note.');
      return;
    }

    setSubmitting(true);
    try {
      await dataService.updateOutfit(outfitId, outfit.updated_at, {
        name: name.trim(),
        description: description.trim(),
        labels,
      });

      markOutfitsDirty();
      showToast('Outfit updated');
      router.dismissTo('/outfits');
    } catch (err) {
      if (err instanceof ConflictError) {
        // Refresh only the OCC baseline (updated_at) - deliberately NOT the
        // text fields, so the user's in-progress edits survive the conflict
        // and pressing Save again applies them, now against the fresh token.
        // This also self-heals the lost-response case: a save that reached
        // the server but never answered comes back here as a false conflict,
        // and the retry simply succeeds.
        try {
          const fresh = await dataService.getOutfitById(outfitId);
          setOutfit(fresh);
          showAlert(
            fresh ? 'Someone else saved changes' : 'Outfit deleted',
            fresh
              ? 'This outfit was changed while you were editing. Your edits are still in the form - review them and press Save Changes again to apply.'
              : 'This outfit was deleted while you were editing.',
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

  if (loadError || !outfit) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>{loadError ?? 'Outfit not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      keyboardShouldPersistTaps="handled"
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
          while the closet had no tags). Saved with Save Changes. */}
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

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: theme.accent },
          !canSubmit && { backgroundColor: theme.textSecondary },
          pressed && styles.submitButtonPressed,
        ]}
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
  maxLength?: number;
};

function LabeledTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  maxLength,
}: LabeledTextInputProps) {
  const { theme } = useTheme();
  const themedInput = {
    backgroundColor: theme.surfaceAlt,
    borderColor: theme.border,
    color: theme.textPrimary,
  };
  return (
    <Field label={label} required={required}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : undefined}
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
  hintText: {
    fontSize: 15,
    marginBottom: 8,
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
