import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  getErrorMessage,
  MAX_VOICE_NOTE_SECONDS,
  type PendingVoiceNote,
  type VoiceNote,
  type VoiceNoteTarget,
} from '@/services/dataService.types';
import { showAlert } from '@/utils/alert';
import { revokeIfBlobUrl } from '@/utils/revokeIfBlobUrl';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  type AudioMode,
  type RecordingOptions,
} from 'expo-audio';

/**
 * iOS only honours recording while the session allows it, and while it does,
 * playback routes to the quiet earpiece - so recording mode is switched on
 * just for the duration of a recording and off again straight after.
 */
function audioMode(allowsRecording: boolean): AudioMode {
  return {
    allowsRecording,
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  };
}
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Short tones that bracket a recording so a screen reader user hears it
// start and stop without needing to read the screen. Expo has no API for
// the OS's own system sounds, so these are two tiny bundled WAVs.
const BEEPS = {
  start: require('../../assets/sounds/beep-start.wav'),
  stop: require('../../assets/sounds/beep-stop.wav'),
};

async function beep(kind: keyof typeof BEEPS): Promise<void> {
  const player = createAudioPlayer(BEEPS[kind]);
  player.play();
  await new Promise(resolve => setTimeout(resolve, 300));
  player.remove();
}

// iOS/Android record AAC in .m4a. Browsers default to Opus in WebM, which
// iOS can't play back, so ask for AAC-in-MP4 wherever the browser offers it
// (Safari always, Chrome on recent versions) and only fall back to WebM.
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  web: {
    mimeType:
      typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm',
    bitsPerSecond: 128000,
  },
};

type VoiceRecorderProps = {
  onRecorded: (recording: PendingVoiceNote) => void;
  disabled?: boolean;
};

/**
 * One button that starts, then stops, a recording capped at
 * MAX_VOICE_NOTE_SECONDS. Microphone permission is requested on the first
 * press (the OS/browser prompt), a beep marks each end of the recording, and
 * a polite live region announces the start and a 5-seconds-left warning -
 * deliberately not every tick, which would talk over the user.
 */
export function VoiceRecorder({ onRecorded, disabled }: VoiceRecorderProps) {
  const { theme } = useTheme();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const startedAtRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  const stopRecording = useCallback(async () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (startedAtRef.current === null) return;
    const durationSeconds = Math.min(
      MAX_VOICE_NOTE_SECONDS,
      Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
    );
    startedAtRef.current = null;

    setBusy(true);
    try {
      await recorder.stop();
      // Leaving the session in record mode routes iOS playback to the quiet
      // earpiece, so switch back before the stop beep and any playback.
      await setAudioModeAsync(audioMode(false));
      await beep('stop');
      if (recorder.uri) onRecorded({ uri: recorder.uri, durationSeconds });
    } catch (err) {
      showAlert("Couldn't finish recording", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsRecording(false);
      setBusy(false);
    }
  }, [recorder, onRecorded]);

  const startRecording = async () => {
    setBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showAlert('Microphone access needed', 'Allow microphone access to record a voice note.');
        return;
      }
      await setAudioModeAsync(audioMode(true));
      await recorder.prepareToRecordAsync();
      await beep('start');
      recorder.record();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setIsRecording(true);
      stopTimeoutRef.current = setTimeout(stopRecording, MAX_VOICE_NOTE_SECONDS * 1000);
    } catch (err) {
      await setAudioModeAsync(audioMode(false)).catch(() => {});
      showAlert("Couldn't start recording", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // Visual countdown only; the live region below announces milestones.
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      if (startedAtRef.current !== null) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [isRecording]);

  useEffect(
    () => () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    },
    [],
  );

  const remaining = Math.max(0, MAX_VOICE_NOTE_SECONDS - elapsed);
  const announcement = !isRecording
    ? ''
    : remaining <= 5
      ? '5 seconds left.'
      : `Recording. Up to ${MAX_VOICE_NOTE_SECONDS} seconds.`;

  return (
    <View>
      <Pressable
        onPress={isRecording ? stopRecording : startRecording}
        disabled={disabled || busy}
        role="button"
        aria-label={isRecording ? 'Stop recording' : 'Record voice note'}
        aria-disabled={disabled || busy}
        style={({ pressed }) => [
          styles.button,
          isRecording ? { backgroundColor: theme.danger } : { backgroundColor: theme.accent },
          (disabled || busy) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, { color: theme.onAccent }]}>
          {isRecording ? 'Stop recording' : 'Record voice note'}
        </Text>
      </Pressable>
      {isRecording && (
        <Text aria-hidden style={[styles.countdown, { color: theme.textSecondary }]}>
          {remaining}s left
        </Text>
      )}
      <Text role="status" style={styles.srOnly}>
        {announcement}
      </Text>
    </View>
  );
}

type VoiceNotePlayerProps = {
  uri: string;
  /** Who recorded it, for the button's accessible name ("Play voice note by Ava, 12 seconds"). */
  recordedBy: string;
  durationSeconds: number;
};

/** A single play/pause toggle for one recording. */
export function VoiceNotePlayer({ uri, recordedBy, durationSeconds }: VoiceNotePlayerProps) {
  const { theme } = useTheme();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) await player.seekTo(0);
    player.play();
  };

  const verb = status.playing ? 'Pause' : 'Play';
  const duration = `${durationSeconds} ${durationSeconds === 1 ? 'second' : 'seconds'}`;
  return (
    <Pressable
      onPress={toggle}
      role="button"
      aria-label={`${verb} voice note by ${recordedBy}, ${duration}`}
      style={({ pressed }) => [
        styles.playButton,
        { borderColor: theme.accent, backgroundColor: theme.surface },
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.playButtonText, { color: theme.textPrimary }]}>
        {status.playing ? '❚❚' : '▶'} {recordedBy} · {durationSeconds}s
      </Text>
    </Pressable>
  );
}

type PendingVoiceNoteFieldProps = {
  value: PendingVoiceNote | null;
  onChange: (recording: PendingVoiceNote | null) => void;
  disabled?: boolean;
};

/**
 * For the create forms, where there's no row to attach to yet: holds one
 * local recording (play it back, or discard and re-record) until the form
 * is saved and the caller uploads it.
 */
export function PendingVoiceNoteField({ value, onChange, disabled }: PendingVoiceNoteFieldProps) {
  const { theme } = useTheme();

  const discard = () => {
    if (value) revokeIfBlobUrl(value.uri);
    onChange(null);
  };

  if (!value) return <VoiceRecorder onRecorded={onChange} disabled={disabled} />;

  return (
    <View style={styles.row}>
      <VoiceNotePlayer uri={value.uri} recordedBy="you" durationSeconds={value.durationSeconds} />
      <Pressable
        onPress={discard}
        disabled={disabled}
        role="button"
        aria-label="Discard recording"
        aria-disabled={disabled}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonPressed]}
      >
        <Text style={[styles.deleteButtonText, { color: theme.danger }]}>Discard</Text>
      </Pressable>
    </View>
  );
}

type VoiceNotesSectionProps = {
  target: VoiceNoteTarget;
  closetId: string;
  /** Show the record button (edit forms). Detail pages leave it off and only list/play/delete. */
  canRecord?: boolean;
};

/**
 * The saved voice notes for one outfit or item: a play button per note, a
 * delete button on the ones this user may delete (their own, or any on a
 * closet they own), and optionally a recorder that uploads straight away.
 */
export default function VoiceNotesSection({ target, closetId, canRecord = false }: VoiceNotesSectionProps) {
  const { theme } = useTheme();
  const { dataService, mode } = useDataMode();
  const { session } = useAuth();
  const { closetMode, activeClosetId } = useCloset();
  const { showToast } = useToast();

  const userId = mode === 'preview' ? 'preview-user' : session?.user.id;
  const isClosetOwner = closetMode === 'my-closet' && activeClosetId === closetId;
  const targetId = 'outfitId' in target ? target.outfitId : target.clothingItemId;
  const targetKind = 'outfitId' in target ? 'outfit' : 'item';

  const [notes, setNotes] = useState<VoiceNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const currentTarget: VoiceNoteTarget = targetKind === 'outfit' ? { outfitId: targetId } : { clothingItemId: targetId };
    dataService
      .getVoiceNotes(currentTarget)
      .then(fetched => {
        if (!cancelled) setNotes(fetched);
      })
      .catch(err => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load voice notes.'));
      });
    return () => {
      cancelled = true;
    };
  }, [dataService, targetKind, targetId]);

  const handleRecorded = useCallback(
    async (recording: PendingVoiceNote) => {
      setIsUploading(true);
      try {
        const note = await dataService.addVoiceNote(target, closetId, recording);
        setNotes(prev => [...(prev ?? []), note]);
        showToast('Voice note saved');
      } catch (err) {
        showAlert("Couldn't save voice note", getErrorMessage(err, 'Something went wrong. Please try again.'));
      } finally {
        setIsUploading(false);
      }
    },
    [dataService, target, closetId, showToast],
  );

  const handleDelete = (note: VoiceNote) => {
    showAlert('Delete voice note', `Delete the voice note by ${note.recorded_by}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dataService.deleteVoiceNote(note);
            setNotes(prev => (prev ?? []).filter(candidate => candidate.id !== note.id));
            showToast('Voice note deleted');
          } catch (err) {
            showAlert("Couldn't delete voice note", getErrorMessage(err, 'Something went wrong. Please try again.'));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text role="heading" style={[styles.heading, { color: theme.textPrimary }]}>
        Voice notes
      </Text>

      {error ? (
        <Text style={[styles.emptyText, { color: theme.danger }]}>{error}</Text>
      ) : notes && notes.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No voice notes yet.</Text>
      ) : (
        (notes ?? []).map(note => (
          <View key={note.id} style={styles.row}>
            <VoiceNotePlayer uri={note.audio_url} recordedBy={note.recorded_by} durationSeconds={note.duration_seconds} />
            {(note.created_by_user_id === userId || isClosetOwner) && (
              <Pressable
                onPress={() => handleDelete(note)}
                role="button"
                aria-label={`Delete voice note by ${note.recorded_by}`}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonPressed]}
              >
                <Text style={[styles.deleteButtonText, { color: theme.danger }]}>Delete</Text>
              </Pressable>
            )}
          </View>
        ))
      )}

      {canRecord && <VoiceRecorder onRecorded={handleRecorded} disabled={isUploading} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  countdown: {
    marginTop: 6,
    fontSize: 14,
    textAlign: 'center',
  },
  playButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    marginBottom: 8,
  },
  // Visually hidden but still read by screen readers.
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
