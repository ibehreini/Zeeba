import { useState } from 'react';
import { ActivityIndicator, Button, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';

export default function Index() {
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

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{mode === 'preview' ? 'Welcome guest!' : 'Home screen'}</Text>

      {session && (
        <Text style={styles.welcomeText}>
          Welcome, {displayName}
          {session.user.email && session.user.email !== displayName ? ` (${session.user.email})` : ''}
        </Text>
      )}

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, closetMode === 'stylist' && styles.toggleButtonActive]}
          onPress={() => setClosetMode('stylist')}
          accessibilityRole="button"
          accessibilityState={{ selected: closetMode === 'stylist' }}
        >
          <Text style={[styles.toggleText, closetMode === 'stylist' && styles.toggleTextActive]}>Stylist</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, closetMode === 'my-closet' && styles.toggleButtonActive]}
          onPress={() => setClosetMode('my-closet')}
          accessibilityRole="button"
          accessibilityState={{ selected: closetMode === 'my-closet' }}
        >
          <Text style={[styles.toggleText, closetMode === 'my-closet' && styles.toggleTextActive]}>My Closet</Text>
        </Pressable>
      </View>

      {closetMode === 'stylist' && <JoinClosetForm onJoin={joinCloset} />}

      {closetMode === 'stylist' && stylistClosets && stylistClosets.length > 0 && (
        <View style={styles.card} accessibilityRole="radiogroup" accessibilityLabel="Collaborator closets">
          {stylistClosets.map(closet => {
            const isActive = closet.closet_id === activeClosetId;
            return (
              <Pressable
                key={closet.closet_id}
                style={styles.closetRow}
                onPress={() => selectStylistCloset(closet.closet_id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive, checked: isActive }}
              >
                <Text style={styles.closetRowText}>{closet.closet_name}</Text>
              </Pressable>
            );
          })}
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

function JoinClosetForm({ onJoin }: { onJoin: (passphrase: string) => Promise<string> }) {
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleJoin = async () => {
    setSubmitting(true);
    try {
      const closetName = await onJoin(passphrase);
      setResult({ success: true, message: `You've joined "${closetName}".` });
      setPassphrase('');
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to join closet.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Join a closet</Text>
      <TextInput
        style={styles.input}
        value={passphrase}
        onChangeText={setPassphrase}
        placeholder="Enter passphrase"
        editable={!submitting}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {submitting ? <ActivityIndicator /> : <Button title="Join" onPress={handleJoin} disabled={!passphrase.trim()} />}

      <Modal visible={result !== null} transparent animationType="fade" onRequestClose={() => setResult(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{result?.success ? 'Success' : 'Error'}</Text>
            <Text style={styles.modalMessage}>{result?.message}</Text>
            <Button title="OK" onPress={() => setResult(null)} />
          </View>
        </View>
      </Modal>
    </View>
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
        <Pressable onPress={handleCopy} accessibilityRole="button">
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
    paddingVertical: 8,
  },
  closetRowText: {
    fontSize: 15,
    color: '#000',
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
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  modalMessage: {
    fontSize: 15,
    color: '#000',
    textAlign: 'center',
  },
});
