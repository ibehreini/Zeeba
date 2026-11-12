import LoadingIndicator from '@/components/LoadingIndicator';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  getErrorMessage,
  MAX_OUTFIT_LABEL_LENGTH,
  MAX_OUTFIT_LABELS,
  validateNewOutfitLabel,
} from '@/services/dataService.types';
import { showAlert } from '@/utils/alert';
import { announceForScreenReader, focusOnWeb } from '@/utils/announce';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

/** One row of the "Your tags" list. A removed row stays (struck through, with Undo) until the screen is next opened. */
export type TagRow = { name: string; removed: boolean; busy: boolean };

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'no-closet' }
  | { status: 'ready'; closetId: string; closetName: string };

/**
 * Merges the server's list into the rows on screen after a change. Active
 * rows follow the server; a row the server no longer has becomes (or stays)
 * "removed" in place rather than disappearing, so the focused Undo button is
 * never unmounted. A removed row is dropped if the same tag came back with
 * different capitalisation, and tags added elsewhere are appended.
 */
export function reconcileTagRows(previous: TagRow[], serverLabels: readonly string[]): TagRow[] {
  const serverSet = new Set(serverLabels);
  const serverLower = new Set(serverLabels.map(label => label.toLowerCase()));
  const rows: TagRow[] = [];
  for (const row of previous) {
    if (serverSet.has(row.name)) rows.push({ ...row, removed: false });
    else if (!serverLower.has(row.name.toLowerCase())) rows.push({ ...row, removed: true });
  }
  const shown = new Set(rows.map(row => row.name));
  for (const label of serverLabels) {
    if (!shown.has(label)) rows.push({ name: label, removed: false, busy: false });
  }
  return rows;
}

/**
 * Settings > Edit tags. Always edits the signed-in user's OWN closet, even
 * while the Home toggle is on Stylist - stylists use the owner's tags but
 * can't change them (the RPCs enforce that too).
 *
 * Accessibility: no control that can hold focus is ever disabled or
 * unmounted by its own action. Remove flips to Undo on the same button (no
 * confirm dialog - nothing is destroyed, and Undo puts the tag back in the
 * same place), "Add tag" and "Try again" stay pressable while busy and just
 * ignore extra presses. So neither VoiceOver nor web focus is ever lost, and
 * no programmatic VoiceOver focus moves are needed. Every outcome is spoken:
 * toasts for success, role="alert" text (web) or an announcement (native)
 * for validation, an alert dialog for row failures.
 */
export default function TagEditor() {
  const { theme } = useTheme();
  const { dataService, mode } = useDataMode();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { applyClosetLabels, startLabelsRequest } = useCloset();
  const { showToast } = useToast();

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [rows, setRows] = useState<TagRow[]>([]);
  const [draft, setDraft] = useState('');
  // nonce remounts the alert Text, so the same message repeated is announced again on web.
  const [inputError, setInputError] = useState<{ message: string; nonce: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const inputRef = useRef<TextInput>(null);
  const addHeadingRef = useRef<Text>(null);
  const retryFocusPending = useRef(false);
  // Mirrors of state read by async handlers, so a double press is caught
  // before React has re-rendered with the busy flag.
  const addingRef = useRef(false);
  const rowsRef = useRef<TagRow[]>([]);
  rowsRef.current = rows;

  useFocusEffect(
    useCallback(() => {
      if (mode === 'live' && !userId) return;
      let cancelled = false;
      const ticket = startLabelsRequest();

      dataService
        .getOwnCloset(userId)
        .then(closet => {
          if (cancelled) return;
          if (!closet) {
            setLoad({ status: 'no-closet' });
            return;
          }
          // Fresh rows on every visit is what clears rows removed last time.
          setRows(closet.outfit_labels.map(name => ({ name, removed: false, busy: false })));
          setLoad({ status: 'ready', closetId: closet.closet_id, closetName: closet.closet_name });
          applyClosetLabels(closet.closet_id, closet.outfit_labels, ticket);
        })
        .catch(err => {
          if (cancelled) return;
          // Re-focusing an already-loaded screen keeps what's on it.
          setLoad(prev => {
            if (prev.status === 'ready') return prev;
            const message = getErrorMessage(err, 'Failed to load your tags.');
            announceForScreenReader(message);
            return { status: 'error', message };
          });
        })
        .finally(() => {
          if (!cancelled) setRetrying(false);
        });

      return () => {
        cancelled = true;
      };
    }, [dataService, mode, userId, reloadKey, applyClosetLabels, startLabelsRequest]),
  );

  // After a successful retry the "Try again" button is gone; on web, put
  // focus somewhere sensible instead of letting it fall to <body>.
  useEffect(() => {
    if (load.status === 'ready' && retryFocusPending.current) {
      retryFocusPending.current = false;
      focusOnWeb(addHeadingRef.current);
    }
  }, [load.status]);

  const handleRetry = () => {
    if (retrying) return;
    retryFocusPending.current = true;
    setRetrying(true);
    setReloadKey(key => key + 1);
  };

  const failInput = (message: string) => {
    setInputError(prev => ({ message, nonce: (prev?.nonce ?? 0) + 1 }));
    announceForScreenReader(message);
    if (Platform.OS === 'web') inputRef.current?.focus();
  };

  const setRowBusy = (name: string, busy: boolean) =>
    setRows(prev => prev.map(row => (row.name === name ? { ...row, busy } : row)));

  const restore = async (closetId: string, row: TagRow) => {
    const current = rowsRef.current;
    const index = current.findIndex(candidate => candidate.name === row.name);
    // Back where it was among the tags that are still there.
    const atIndex = current.slice(0, Math.max(index, 0)).filter(candidate => !candidate.removed).length;
    const labels = await dataService.addClosetOutfitLabel(closetId, row.name, atIndex);
    setRows(prev => reconcileTagRows(prev.map(r => (r.name === row.name ? { ...r, busy: false } : r)), labels));
    applyClosetLabels(closetId, labels);
  };

  const handleAdd = async () => {
    if (addingRef.current || load.status !== 'ready') return;
    const activeNames = rows.filter(row => !row.removed).map(row => row.name);
    const result = validateNewOutfitLabel(draft, activeNames);
    if (!result.ok) {
      failInput(result.message);
      return;
    }

    addingRef.current = true;
    setAdding(true);
    try {
      // Typing back exactly a tag that was just removed is the same as
      // Undo: it returns to its old place instead of jumping to the end, so
      // this list and the Outfits pills stay in the same order.
      const removedMatch = rows.find(row => row.removed && row.name === result.label);
      if (removedMatch) {
        await restore(load.closetId, removedMatch);
      } else {
        const labels = await dataService.addClosetOutfitLabel(load.closetId, result.label);
        setRows(prev => reconcileTagRows(prev, labels));
        applyClosetLabels(load.closetId, labels);
      }
      setDraft('');
      setInputError(null);
      showToast(`Added tag ${result.label}`);
    } catch (err) {
      failInput(getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  const handleRemove = async (row: TagRow) => {
    if (load.status !== 'ready') return;
    const live = rowsRef.current.find(candidate => candidate.name === row.name);
    if (!live || live.busy) return;
    rowsRef.current = rowsRef.current.map(r => (r.name === row.name ? { ...r, busy: true } : r));
    setRowBusy(row.name, true);
    try {
      const labels = await dataService.removeClosetOutfitLabel(load.closetId, row.name);
      setRows(prev =>
        reconcileTagRows(
          prev.map(r => (r.name === row.name ? { ...r, removed: true, busy: false } : r)),
          labels,
        ),
      );
      applyClosetLabels(load.closetId, labels);
      showToast(`Removed tag ${row.name}. Undo is available.`);
    } catch (err) {
      setRowBusy(row.name, false);
      showAlert('Couldn’t remove tag', getErrorMessage(err, 'Something went wrong. Please try again.'));
    }
  };

  const handleUndo = async (row: TagRow) => {
    if (load.status !== 'ready') return;
    const live = rowsRef.current.find(candidate => candidate.name === row.name);
    if (!live || live.busy) return;
    rowsRef.current = rowsRef.current.map(r => (r.name === row.name ? { ...r, busy: true } : r));
    setRowBusy(row.name, true);
    try {
      await restore(load.closetId, row);
      showToast(`Restored tag ${row.name}`);
    } catch (err) {
      setRowBusy(row.name, false);
      showAlert('Couldn’t restore tag', getErrorMessage(err, 'Something went wrong. Please try again.'));
    }
  };

  const secondary = { color: theme.textSecondary };
  const primary = { color: theme.textPrimary };
  const card = { backgroundColor: theme.surface, borderColor: theme.border };

  if (load.status === 'loading') return <LoadingIndicator label="Loading tags" />;

  if (load.status === 'error') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text role="alert" style={[styles.body, { color: theme.danger }]}>
          {load.message}
        </Text>
        {/* Stays mounted while retrying (busy, not disabled) so focus isn't dropped. */}
        <Pressable
          onPress={handleRetry}
          role="button"
          aria-busy={retrying}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.accent },
            (pressed || retrying) && styles.dimmed,
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: theme.onAccent }]}>Try again</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (load.status === 'no-closet') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.body, primary]}>
          You don’t have a closet of your own yet, so there are no tags to edit. Create your closet on the Home tab
          first. Tags for closets you style are managed by their owners.
        </Text>
      </ScrollView>
    );
  }

  const activeCount = rows.filter(row => !row.removed).length;
  const countSentence =
    activeCount === 0
      ? 'You have no tags. Outfits can still be created without one.'
      : `${activeCount} ${activeCount === 1 ? 'tag' : 'tags'}. You can have up to ${MAX_OUTFIT_LABELS}.`;

  // React Native's types don't declare these, but react-native-web forwards
  // every aria-* prop to the DOM (same trick as ariaCurrentPage in
  // HeaderNav.web.tsx). Native gets accessibilityHint instead.
  const webInputAria: Record<string, string> =
    Platform.OS === 'web'
      ? {
          'aria-describedby': inputError ? 'new-tag-error new-tag-hint' : 'new-tag-hint',
          ...(inputError ? { 'aria-invalid': 'true' } : {}),
        }
      : {};

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={[styles.intro, secondary]}>
        Tags describe an outfit’s vibe or occasion, like Casual or Date Night. You pick them when you create or edit
        an outfit, and you can filter your outfits by tag.
      </Text>
      <Text style={[styles.intro, secondary]}>
        These tags belong to your closet, {load.closetName}. Stylists on your closet use the same list.
      </Text>

      <View style={[styles.card, card]}>
        <Text ref={addHeadingRef} role="heading" aria-level={2} style={[styles.cardTitle, primary]}>
          Add a tag
        </Text>
        <Text style={[styles.fieldLabel, primary]}>New tag</Text>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={text => {
            setDraft(text);
            if (inputError) setInputError(null);
          }}
          placeholder="e.g. Vintage"
          placeholderTextColor={theme.textSecondary}
          maxLength={MAX_OUTFIT_LABEL_LENGTH}
          autoCapitalize="words"
          enterKeyHint="done"
          onSubmitEditing={handleAdd}
          // submitBehavior is what native reads; react-native-web 0.21 only
          // understands the older blurOnSubmit. Both keep focus (and the
          // keyboard) in the field after Enter/Done so tags can be added in a row.
          submitBehavior="submit"
          blurOnSubmit={false}
          aria-label="New tag"
          accessibilityHint={`Up to ${MAX_OUTFIT_LABEL_LENGTH} characters`}
          style={[
            styles.input,
            { backgroundColor: theme.surfaceAlt, borderColor: inputError ? theme.danger : theme.controlBorder, color: theme.textPrimary },
          ]}
          {...webInputAria}
        />
        <Text nativeID="new-tag-hint" id="new-tag-hint" style={[styles.hint, secondary]}>
          Up to {MAX_OUTFIT_LABEL_LENGTH} characters.
        </Text>
        {inputError && (
          <Text
            key={inputError.nonce}
            nativeID="new-tag-error"
            id="new-tag-error"
            role="alert"
            style={[styles.errorText, { color: theme.danger }]}
          >
            {inputError.message}
          </Text>
        )}
        <Pressable
          onPress={handleAdd}
          role="button"
          aria-busy={adding}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.accent },
            (pressed || adding) && styles.dimmed,
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: theme.onAccent }]}>Add tag</Text>
        </Pressable>
      </View>

      <View style={[styles.card, card]}>
        <Text role="heading" aria-level={2} style={[styles.cardTitle, primary]}>
          Your tags
        </Text>
        <Text style={[styles.body, primary]}>{countSentence}</Text>
        <Text style={[styles.hint, secondary]}>
          Removing a tag takes it off this list and the outfit filter. Outfits that already have it keep it until you
          edit that outfit.
        </Text>

        {rows.length > 0 && (
          <View role="list" aria-label="Your tags">
            {rows.map((row, index) => (
              // Keyed by name so the Pressable is the same element whether it
              // says Remove or Undo - focus stays on it as it flips.
              <View role="listitem" key={row.name}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={styles.tagRow}>
                  <Text style={[styles.tagName, row.removed ? secondary : primary]}>
                    <Text style={row.removed && styles.struck}>{row.name}</Text>
                    {row.removed ? ' (removed)' : ''}
                  </Text>
                  <Pressable
                    onPress={() => (row.removed ? handleUndo(row) : handleRemove(row))}
                    role="button"
                    aria-label={row.removed ? `Undo remove tag ${row.name}` : `Remove tag ${row.name}`}
                    aria-busy={row.busy}
                    style={({ pressed }) => [styles.rowButton, (pressed || row.busy) && styles.dimmed]}
                  >
                    <Text style={[styles.rowButtonText, { color: row.removed ? theme.link : theme.danger }]}>
                      {row.removed ? 'Undo' : 'Remove'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  intro: {
    fontSize: 15,
  },
  body: {
    fontSize: 15,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dimmed: {
    opacity: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  tagName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 16,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  rowButton: {
    minHeight: 48,
    minWidth: 64,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
