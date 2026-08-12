import { useState } from 'react';
import { ActivityIndicator, Button, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useIsFocused } from 'expo-router';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useWebModalBackHandler } from '@/hooks/useWebModalBackHandler';

export default function Index() {
  // react-navigation's web tab view only hides inactive tabs visually
  // (absolute position + pointer-events: none) - it never removes them from
  // the DOM, so NVDA's browse-mode buffer still contains the last-visited
  // tab's content. Marking our own root aria-hidden while unfocused is what
  // actually pulls this screen's content out of the accessibility tree.
  const isFocused = useIsFocused();
  const { mode } = useDataMode();
  const { session, signOut } = useAuth();
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
      <Text style={styles.text}>{mode === 'preview' ? 'Welcome guest!' : 'Home screen'}</Text>

      {session && (
        <Text style={styles.welcomeText}>
          Welcome, {displayName}
          {session.user.email && session.user.email !== displayName ? ` (${session.user.email})` : ''}
        </Text>
      )}

      <View style={styles.toggleRow} role="radiogroup" aria-label="Closet view">
        <Pressable
          style={[styles.toggleButton, closetMode === 'stylist' && styles.toggleButtonActive]}
          onPress={() => setClosetMode('stylist')}
          role="radio"
          aria-checked={closetMode === 'stylist'}
        >
          <Text style={[styles.toggleText, closetMode === 'stylist' && styles.toggleTextActive]}>Stylist</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, closetMode === 'my-closet' && styles.toggleButtonActive]}
          onPress={() => setClosetMode('my-closet')}
          role="radio"
          aria-checked={closetMode === 'my-closet'}
        >
          <Text style={[styles.toggleText, closetMode === 'my-closet' && styles.toggleTextActive]}>My Closet</Text>
        </Pressable>
      </View>

      {closetMode === 'stylist' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle} role="heading">
            Closets you are a part of as a stylist
          </Text>

          {!stylistClosets ? (
            <ActivityIndicator aria-label="Loading your closets" />
          ) : stylistClosets.length === 0 ? (
            <Text style={styles.hintText}>You aren&apos;t part of any closets as a stylist yet.</Text>
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
                    <View style={styles.radioOuter}>{isActive && <View style={styles.radioInner} />}</View>
                    <Text style={styles.closetRowText}>{closet.closet_name}</Text>
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

      <Button title="Sign out" onPress={signOut} />
    </View>
  );
}

function NewClosetForm({ onCreate }: { onCreate: (closetName: string) => Promise<void> }) {
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
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Name your closet</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ida's Closet"
        editable={!submitting}
        autoCapitalize="words"
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
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
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useWebModalBackHandler(visible, onClose);

  const handleClose = () => {
    setPassphrase('');
    setError(null);
    onClose();
  };

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
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard} role="dialog" aria-label="Join a closet" accessibilityViewIsModal>
          <Text style={styles.modalTitle} role="heading">
            Join a closet
          </Text>
          <TextInput
            style={styles.input}
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
            <Text style={styles.errorText} role="alert">
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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(passphrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{closetName}</Text>
      <View style={styles.passphraseRow}>
        <Text style={styles.passphraseText}>Passphrase: {passphrase}</Text>
        <Pressable onPress={handleCopy} role="button">
          <Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy'}</Text>
        </Pressable>
      </View>
      <Text style={styles.hintText}>Share this with a stylist so they can access your closet.</Text>
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
  text: {
    color: '#000',
  },
  welcomeText: {
    color: '#000',
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
    color: '#000',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#25292e',
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    overflow: 'hidden',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  toggleButtonActive: {
    backgroundColor: '#25292e',
  },
  toggleText: {
    color: '#25292e',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  card: {
    width: '85%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#000',
  },
  passphraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passphraseText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  copyText: {
    color: '#1a73e8',
    fontWeight: '600',
    fontSize: 14,
  },
  hintText: {
    fontSize: 13,
    color: '#666',
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
});
