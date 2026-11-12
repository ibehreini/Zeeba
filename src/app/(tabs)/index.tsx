import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useIsFocused } from 'expo-router';
import ErrorText from '@/components/ErrorText';
import FormButton from '@/components/FormButton';
import LoadingIndicator from '@/components/LoadingIndicator';
import NewClosetForm from '@/components/NewClosetForm';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { useWebModalBackHandler } from '@/hooks/useWebModalBackHandler';
import { announceForScreenReader } from '@/utils/announce';

export default function Index() {
  // react-navigation's web tab view only hides inactive tabs visually
  // (absolute position + pointer-events: none) - it never removes them from
  // the DOM, so NVDA's browse-mode buffer still contains the last-visited
  // tab's content. Marking our own root aria-hidden while unfocused is what
  // actually pulls this screen's content out of the accessibility tree.
  const isFocused = useIsFocused();
  const { mode } = useDataMode();
  const { session } = useAuth();
  const { theme } = useTheme();
  const {
    closetMode,
    selectCloset,
    activeClosetId,
    activeClosetName,
    ownClosetName,
    stylistClosets,
    isLoadingClosets,
    closetsError,
    refreshClosets,
    needsOwnClosetSetup,
    ownClosetPassphrase,
    joinCloset,
  } = useCloset();

  const displayName = session?.user.user_metadata?.full_name ?? session?.user.email;
  const email = session?.user.email;
  const [joinVisible, setJoinVisible] = useState(false);

  // Coming back to Home re-reads both lists, so a closet someone just shared
  // shows up. Only on a return - the first load is ClosetContext's own.
  const wasFocused = useRef(isFocused);
  useEffect(() => {
    if (isFocused && !wasFocused.current) refreshClosets();
    wasFocused.current = isFocused;
  }, [isFocused, refreshClosets]);

  // Says which closet the other tabs now show. Nothing moves focus when a
  // radio is picked, so it is also announced after a switch: by VoiceOver
  // below, and by the web live region it renders in.
  const status = activeClosetName
    ? closetMode === 'stylist'
      ? `You're styling ${activeClosetName}.`
      : `Showing your closet, ${activeClosetName}.`
    : null;

  // Set by a user's switch, so restoring or refreshing never speaks up. Both
  // lists are already loaded, so the status changes in the same render.
  const announceNext = useRef(false);
  useEffect(() => {
    if (announceNext.current && status) announceForScreenReader(status);
    announceNext.current = false;
  }, [status]);

  /** null = the user's own closet. */
  const switchCloset = (stylistClosetId: string | null) => {
    if (stylistClosetId === (closetMode === 'stylist' ? activeClosetId : null)) return;
    announceNext.current = true;
    selectCloset(stylistClosetId);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} aria-hidden={!isFocused}>
      <View>
        <Text style={[styles.greeting, { color: theme.textPrimary }]} role="heading" aria-level={2}>
          {mode === 'preview' || !displayName ? 'Welcome, guest' : `Hi, ${displayName}`}
        </Text>
        {email && email !== displayName && (
          <Text style={[styles.hintText, { color: theme.textSecondary }]}>{email}</Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]} role="heading" aria-level={2}>
          Which closet?
        </Text>

        {isLoadingClosets ? (
          <LoadingIndicator label="Loading your closets" />
        ) : (
          <View role="radiogroup" aria-label="Which closet?">
            <ClosetRadio
              title={ownClosetName ?? 'My closet'}
              detail={ownClosetName ? 'My closet' : needsOwnClosetSetup ? 'Not set up yet' : null}
              label={
                ownClosetName
                  ? `My closet: ${ownClosetName}`
                  : needsOwnClosetSetup
                    ? 'My closet, not set up yet'
                    : 'My closet'
              }
              checked={closetMode === 'my-closet'}
              onPress={() => switchCloset(null)}
            />
            {stylistClosets?.map(closet => (
              <ClosetRadio
                key={closet.closet_id}
                title={closet.closet_name}
                detail="You're a stylist"
                label={`${closet.closet_name}, stylist`}
                checked={closetMode === 'stylist' && closet.closet_id === activeClosetId}
                onPress={() => switchCloset(closet.closet_id)}
              />
            ))}
          </View>
        )}

        <FormButton title="Join closet" variant="secondary" onPress={() => setJoinVisible(true)} />
        <JoinClosetModal visible={joinVisible} onClose={() => setJoinVisible(false)} onJoin={joinCloset} />
      </View>

      <View aria-live={Platform.OS === 'web' ? 'polite' : undefined}>
        {status && <Text style={[styles.statusText, { color: theme.textPrimary }]}>{status}</Text>}
      </View>

      {closetsError && (
        <ErrorText style={[styles.errorText, { color: theme.danger }]}>{closetsError}</ErrorText>
      )}

      {closetMode === 'my-closet' && needsOwnClosetSetup && <NewClosetForm style={styles.fullWidth} />}

      {closetMode === 'my-closet' && ownClosetName && ownClosetPassphrase && (
        <ClosetPassphraseCard closetName={ownClosetName} passphrase={ownClosetPassphrase} />
      )}
    </ScrollView>
  );
}

type ClosetRadioProps = {
  title: string;
  /** Second line, in text so what kind of closet it is never relies on colour. */
  detail: string | null;
  /** The accessible name - unambiguous out of context, unlike the title alone. */
  label: string;
  checked: boolean;
  onPress: () => void;
};

function ClosetRadio({ title, detail, label, checked, onPress }: ClosetRadioProps) {
  const { theme } = useTheme();
  return (
    <Pressable style={styles.closetRow} onPress={onPress} role="radio" aria-checked={checked} aria-label={label}>
      <View style={[styles.radioOuter, { borderColor: theme.accent }]}>
        {checked && <View style={[styles.radioInner, { backgroundColor: theme.accent }]} />}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.closetRowText, { color: theme.textPrimary }]}>{title}</Text>
        {detail && <Text style={[styles.hintText, { color: theme.textSecondary }]}>{detail}</Text>}
      </View>
    </Pressable>
  );
}

type JoinClosetModalProps = {
  visible: boolean;
  onClose: () => void;
  onJoin: (passphrase: string) => Promise<string>;
};

/**
 * Focus is trapped inside the dialog on both platforms: on web
 * react-native-web's <Modal> renders an `aria-modal` dialog with tab-focus
 * brackets and restores focus to the trigger on close, and on iOS
 * `accessibilityViewIsModal` stops VoiceOver from reaching the screen behind.
 */
function JoinClosetModal({ visible, onClose, onJoin }: JoinClosetModalProps) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setPassphrase('');
    setError(null);
    onClose();
  };

  // handleClose, not onClose: the back gesture must also clear the typed
  // passphrase and stale error, same as Cancel and onRequestClose do.
  useWebModalBackHandler(visible, handleClose);

  const handleJoin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const closetName = await onJoin(passphrase);
      handleClose();
      showToast(`You've joined "${closetName}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join closet.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <View
          style={[styles.modalCard, { backgroundColor: theme.surface }]}
          role="dialog"
          aria-label="Join a closet"
          accessibilityViewIsModal
        >
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]} role="heading" aria-level={2}>
            Join a closet
          </Text>
          <TextInput
            style={[styles.input, { borderColor: theme.controlBorder, color: theme.textPrimary }]}
            placeholderTextColor={theme.textSecondary}
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Enter closet code"
            aria-label="Closet code"
            editable={!submitting}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {error && (
            <ErrorText style={[styles.errorText, { color: theme.danger }]}>{error}</ErrorText>
          )}
          {submitting ? (
            <LoadingIndicator label="Joining closet" />
          ) : (
            <View style={styles.modalActions}>
              <FormButton title="Cancel" variant="secondary" onPress={handleClose} style={styles.flex} />
              <FormButton title="Join" onPress={handleJoin} disabled={!passphrase.trim()} style={styles.flex} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ClosetPassphraseCard({ closetName, passphrase }: { closetName: string; passphrase: string }) {
  const { theme } = useTheme();
  const { showToast } = useToast();

  // The toast is what confirms the copy, visibly and to screen readers.
  const handleCopy = () => {
    Clipboard.setStringAsync(passphrase).then(
      () => showToast('Passphrase copied.'),
      () => showToast("Couldn't copy the passphrase."),
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]} role="heading" aria-level={2}>
        Invite a stylist
      </Text>
      <View style={styles.passphraseRow}>
        {/* Spelled out so VoiceOver reads the random code character by character instead of guessing words. */}
        <Text
          style={[styles.passphraseText, { color: theme.textPrimary }]}
          aria-label={`Passphrase: ${passphrase.split('').join(' ')}`}
        >
          Passphrase: {passphrase}
        </Text>
        <Pressable onPress={handleCopy} role="button" aria-label="Copy passphrase" style={styles.copyButton}>
          <Text style={[styles.copyText, { color: theme.link }]}>Copy</Text>
        </Pressable>
      </View>
      <Text style={[styles.hintText, { color: theme.textSecondary }]}>
        Share it with a friend or family member so they can help style {closetName}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: 16,
    paddingTop: 24,
    gap: 16,
  },
  flex: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  closetRowText: {
    fontSize: 16,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  passphraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  passphraseText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  copyButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    maxWidth: 480,
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
});
