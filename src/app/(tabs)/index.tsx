import { useState } from 'react';
import { ActivityIndicator, Button, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useIsFocused } from 'expo-router';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { useWebModalBackHandler } from '@/hooks/useWebModalBackHandler';

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
    setClosetMode,
    activeClosetId,
    activeClosetName,
    stylistClosets,
    selectStylistCloset,
    needsOwnClosetSetup,
    ownClosetPassphrase,
    createOwnCloset,
    joinCloset,
  } = useCloset();

  const displayName = session?.user.user_metadata?.full_name ?? session?.user.email;
  const [joinVisible, setJoinVisible] = useState(false);

  return (
    <View style={styles.container} aria-hidden={!isFocused}>
      <Text style={{ color: theme.textPrimary }}>
        {mode === 'preview' ? 'Welcome guest!' : 'Home screen'}
      </Text>

      {session && (
        <Text style={[styles.welcomeText, { color: theme.textPrimary }]}>
          Welcome, {displayName}
          {session.user.email && session.user.email !== displayName ? ` (${session.user.email})` : ''}
        </Text>
      )}

      <View
        style={[styles.toggleRow, { borderColor: theme.border }]}
        role="radiogroup"
        aria-label="Closet view"
      >
        <Pressable
          style={[
            styles.toggleButton,
            { backgroundColor: closetMode === 'stylist' ? theme.accent : theme.surface },
          ]}
          onPress={() => setClosetMode('stylist')}
          role="radio"
          aria-checked={closetMode === 'stylist'}
        >
          <Text
            style={[
              styles.toggleText,
              { color: closetMode === 'stylist' ? theme.onAccent : theme.textPrimary },
            ]}
          >
            Stylist
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            { backgroundColor: closetMode === 'my-closet' ? theme.accent : theme.surface },
          ]}
          onPress={() => setClosetMode('my-closet')}
          role="radio"
          aria-checked={closetMode === 'my-closet'}
        >
          <Text
            style={[
              styles.toggleText,
              { color: closetMode === 'my-closet' ? theme.onAccent : theme.textPrimary },
            ]}
          >
            My Closet
          </Text>
        </Pressable>
      </View>

      {closetMode === 'stylist' && (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]} role="heading">
            Closets you are a part of as a stylist
          </Text>

          {!stylistClosets ? (
            <ActivityIndicator aria-label="Loading your closets" />
          ) : stylistClosets.length === 0 ? (
            <Text style={[styles.hintText, { color: theme.textSecondary }]}>
              You aren&apos;t part of any closets as a stylist yet.
            </Text>
          ) : (
            <View role="radiogroup" aria-label="Active closets">
              {stylistClosets.map(closet => {
                const isActive = closet.closet_id === activeClosetId;
                return (
                  <Pressable
                    key={closet.closet_id}
                    style={styles.closetRow}
                    onPress={() => selectStylistCloset(closet.closet_id)}
                    role="radio"
                    aria-checked={isActive}
                    aria-label={closet.closet_name}
                  >
                    <View style={[styles.radioOuter, { borderColor: theme.accent }]}>
                      {isActive && <View style={[styles.radioInner, { backgroundColor: theme.accent }]} />}
                    </View>
                    <Text style={[styles.closetRowText, { color: theme.textPrimary }]}>
                      {closet.closet_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Button title="Join closet" onPress={() => setJoinVisible(true)} />

          <JoinClosetModal visible={joinVisible} onClose={() => setJoinVisible(false)} onJoin={joinCloset} />
        </View>
      )}

      {closetMode === 'my-closet' && needsOwnClosetSetup && <NewClosetForm onCreate={createOwnCloset} />}

      {closetMode === 'my-closet' && activeClosetName && ownClosetPassphrase && (
        <ClosetPassphraseCard closetName={activeClosetName} passphrase={ownClosetPassphrase} />
      )}
    </View>
  );
}

function NewClosetForm({ onCreate }: { onCreate: (closetName: string) => Promise<void> }) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create closet.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Name your closet</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
        placeholderTextColor={theme.textSecondary}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ida's Closet"
        editable={!submitting}
        autoCapitalize="words"
      />
      {error && <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>}
      {submitting ? (
        <ActivityIndicator />
      ) : (
        <Button title="Create closet" onPress={handleSubmit} />
      )}
    </View>
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
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]} role="heading">
            Join a closet
          </Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
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
            <Text style={[styles.errorText, { color: theme.danger }]} role="alert">
              {error}
            </Text>
          )}
          {submitting ? (
            <ActivityIndicator aria-label="Joining closet" />
          ) : (
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={handleClose} />
              <Button title="Join" onPress={handleJoin} disabled={!passphrase.trim()} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ClosetPassphraseCard({ closetName, passphrase }: { closetName: string; passphrase: string }) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(passphrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{closetName}</Text>
      <View style={styles.passphraseRow}>
        <Text style={[styles.passphraseText, { color: theme.textPrimary }]}>
          Passphrase: {passphrase}
        </Text>
        <Pressable onPress={handleCopy} role="button">
          <Text style={[styles.copyText, { color: theme.link }]}>{copied ? 'Copied!' : 'Copy'}</Text>
        </Pressable>
      </View>
      <Text style={[styles.hintText, { color: theme.textSecondary }]}>
        Share this with a stylist so they can access your closet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    alignItems: 'center',
    gap: 12,
  },
  welcomeText: {
    fontWeight: '500',
  },
  closetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  closetRowText: {
    fontSize: 15,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  toggleText: {
    fontWeight: '600',
  },
  card: {
    width: '85%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  passphraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passphraseText: {
    fontSize: 15,
    fontWeight: '500',
  },
  copyText: {
    fontWeight: '600',
    fontSize: 14,
  },
  hintText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '80%',
    borderRadius: 10,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
});
