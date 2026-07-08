import { useState } from 'react';
import { ActivityIndicator, Button, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';

export default function Index() {
  const { mode } = useDataMode();
  const { signOut } = useAuth();
  const {
    closetMode,
    setClosetMode,
    activeClosetName,
    needsOwnClosetSetup,
    ownClosetPassphrase,
    createOwnCloset,
    regeneratePassphrase,
  } = useCloset();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{mode === 'preview' ? 'Welcome guest!' : 'Home screen'}</Text>

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

      {closetMode === 'my-closet' && needsOwnClosetSetup && <NewClosetForm onCreate={createOwnCloset} />}

      {closetMode === 'my-closet' && activeClosetName && ownClosetPassphrase && (
        <ClosetPassphraseCard
          closetName={activeClosetName}
          passphrase={ownClosetPassphrase}
          onRegenerate={regeneratePassphrase}
        />
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

function ClosetPassphraseCard({
  closetName,
  passphrase,
  onRegenerate,
}: {
  closetName: string;
  passphrase: string;
  onRegenerate: () => Promise<void>;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      await onRegenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate passphrase.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{closetName}</Text>
      <Text style={styles.passphraseText}>Passphrase: {passphrase}</Text>
      <Text style={styles.hintText}>Share this with a stylist so they can access your closet.</Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable onPress={handleRegenerate} disabled={regenerating} accessibilityRole="button">
        <Text style={styles.regenerateText}>{regenerating ? 'Regenerating…' : 'Regenerate passphrase'}</Text>
      </Pressable>
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
  passphraseText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  hintText: {
    fontSize: 13,
    color: '#666',
  },
  regenerateText: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
});
