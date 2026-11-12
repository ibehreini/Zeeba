import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  getErrorMessage,
  MAX_VOICE_NOTE_SECONDS,
  MIN_VOICE_NOTE_SECONDS,
  type PendingVoiceNote,
  type VoiceNote,
  type VoiceNoteTarget,
} from '@/services/dataService.types';
import { showAlert } from '@/utils/alert';
import { announceAndWait, announceForScreenReader, moveScreenReaderFocus } from '@/utils/announce';
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
  type AudioPlayer,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

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

/** "0:07" */
function formatSeconds(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** "12 seconds" */
function spokenDuration(seconds: number): string {
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}

/** "Nov 11" - short enough to show on the row and to read out. */
function formatRecordedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Only one voice note plays at a time: starting one pauses whichever was playing.
let activePlayer: AudioPlayer | null = null;

// Short tones that bracket a recording so a screen reader user hears it
// start and stop without needing to read the screen. Expo has no API for
// the OS's own system sounds, so these are two tiny bundled WAVs.
const BEEPS = {
  start: require('../../assets/sounds/beep-start.wav'),
  stop: require('../../assets/sounds/beep-stop.wav'),
};

/**
 * Every player in this file passes `keepAudioSessionActive`. Without it,
 * expo-audio (iOS) deactivates the whole audio session 0.1s after a player
 * finishes or pauses - checking only for other *players*, not recorders.
 * The start beep finishing did exactly that a moment after recording began,
 * so every note captured ~0.4s (a scratch) and then nothing.
 */
const PLAYER_OPTIONS = { keepAudioSessionActive: true };

async function beep(kind: keyof typeof BEEPS): Promise<void> {
  const player = createAudioPlayer(BEEPS[kind], PLAYER_OPTIONS);
  player.play();
  // Each tone's length plus a small margin (start 0.16s, stop 0.22s), not a flat wait.
  await new Promise(resolve => setTimeout(resolve, kind === 'start' ? 200 : 260));
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

/** A red dot that pulses while the mic is live; holds still under Reduce Motion. */
function RecordingDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduceMotion => {
        if (cancelled || reduceMotion) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.25, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
          ]),
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return <Animated.View style={[styles.recordingDot, { backgroundColor: color, opacity }]} />;
}

type RecorderPhase = 'idle' | 'starting' | 'recording' | 'stopping';

type VoiceRecorderProps = {
  onRecorded: (recording: PendingVoiceNote) => void;
  disabled?: boolean;
  /** Shown (and read) instead of "Record voice note" while the caller is busy, e.g. "Saving voice note". */
  busyLabel?: string;
};

/**
 * One button that starts, then stops, a recording capped at
 * MAX_VOICE_NOTE_SECONDS.
 *
 * Screen reader design - the microphone hears everything VoiceOver says, so
 * nothing is spoken while it's open:
 * - On press the button immediately becomes "Stop recording" (so whatever
 *   VoiceOver reads back after the double-tap happens before recording),
 *   and pressing it again before the tone cancels.
 * - "Recording starts after the tone..." is spoken and waited out, then a
 *   start tone plays and recording begins.
 * - No spoken countdown; the stop tone marks the end, then the result
 *   (and "time limit reached", if that's what stopped it) is announced.
 */
export function VoiceRecorder({ onRecorded, disabled, busyLabel }: VoiceRecorderProps) {
  const { theme } = useTheme();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const startedAtRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelStartRef = useRef(false);
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  // Web only: native announces through the OS (see announce.ts).
  const [webAnnouncement, setWebAnnouncement] = useState('');

  const stopRecording = useCallback(
    async (hitTimeLimit: boolean) => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      if (startedAtRef.current === null) return;
      const wallClockSeconds = (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;

      setPhase('stopping');
      try {
        // What the recorder actually captured, read before stop() resets it.
        // Native only: the web recorder doesn't report a duration.
        const capturedSeconds = Platform.OS === 'web' ? wallClockSeconds : recorder.getStatus().durationMillis / 1000;
        await recorder.stop();
        // Leaving the session in record mode routes iOS playback to the quiet
        // earpiece, so switch back before the stop beep and any playback.
        await setAudioModeAsync(audioMode(false));
        await beep('stop');

        const fail = (message: string) => {
          announceForScreenReader(message);
          setWebAnnouncement(message);
          showAlert("Voice note not saved", message);
          if (recorder.uri) revokeIfBlobUrl(recorder.uri);
        };
        // The recorder stopped hearing the mic partway (an audio session
        // interruption - a call, Siri, another app): don't save a clipped note.
        if (wallClockSeconds - capturedSeconds > 1.5) {
          fail(
            `The recording was cut off after ${spokenDuration(Math.floor(capturedSeconds))}. Please record it again.`,
          );
          return;
        }
        if (capturedSeconds < MIN_VOICE_NOTE_SECONDS) {
          fail(`Voice notes need to be at least ${MIN_VOICE_NOTE_SECONDS} seconds. Please record a longer one.`);
          return;
        }

        const durationSeconds = Math.min(MAX_VOICE_NOTE_SECONDS, Math.round(capturedSeconds));
        const message = `${hitTimeLimit ? 'Time limit reached. ' : ''}Recorded ${spokenDuration(durationSeconds)}.`;
        announceForScreenReader(message);
        setWebAnnouncement(message);
        if (recorder.uri) onRecorded({ uri: recorder.uri, durationSeconds });
      } catch (err) {
        showAlert("Couldn't finish recording", getErrorMessage(err, 'Something went wrong. Please try again.'));
      } finally {
        setPhase('idle');
      }
    },
    [recorder, onRecorded],
  );

  const startRecording = async () => {
    cancelStartRef.current = false;
    setPhase('starting');
    const bail = async () => {
      await setAudioModeAsync(audioMode(false)).catch(() => {});
      setPhase('idle');
    };
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showAlert('Microphone access needed', 'Allow microphone access to record a voice note.');
        setPhase('idle');
        return;
      }

      // Kept short: the mic can't open until the screen reader has finished
      // saying it. The length limits are in the button's hint instead.
      const intro = 'Recording after the tone.';
      setWebAnnouncement(intro);
      await announceAndWait(intro);
      if (cancelStartRef.current) return bail();

      // Tone first (in playback mode, so it's heard even on silent), and
      // only once it has finished is the session switched to recording and
      // the mic opened - nothing else is playing while the recorder runs.
      await setAudioModeAsync(audioMode(false));
      await beep('start');
      if (cancelStartRef.current) return bail();

      await setAudioModeAsync(audioMode(true));
      await recorder.prepareToRecordAsync();
      if (cancelStartRef.current) return bail();

      recorder.record();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setPhase('recording');
      stopTimeoutRef.current = setTimeout(() => stopRecording(true), MAX_VOICE_NOTE_SECONDS * 1000);
    } catch (err) {
      await bail();
      showAlert("Couldn't start recording", getErrorMessage(err, 'Something went wrong. Please try again.'));
    }
  };

  const handlePress = () => {
    if (phase === 'idle') {
      void startRecording();
    } else if (phase === 'starting') {
      cancelStartRef.current = true;
      announceForScreenReader('Recording cancelled.');
      setWebAnnouncement('Recording cancelled.');
    } else if (phase === 'recording') {
      void stopRecording(false);
    }
  };

  // Visual countdown only - deliberately silent for screen readers.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      if (startedAtRef.current !== null) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(
    () => () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    },
    [],
  );

  const isActive = phase === 'starting' || phase === 'recording';
  const isDisabled = phase === 'stopping' || (phase === 'idle' && !!disabled);
  const label = isActive
    ? 'Stop recording'
    : phase === 'stopping'
      ? 'Finishing recording'
      : disabled && busyLabel
        ? busyLabel
        : 'Record voice note';
  const remaining = Math.max(0, MAX_VOICE_NOTE_SECONDS - elapsed);

  return (
    <View>
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        role="button"
        aria-label={label}
        accessibilityHint={
          phase === 'idle' ? `Records ${MIN_VOICE_NOTE_SECONDS} to ${MAX_VOICE_NOTE_SECONDS} seconds. Starts after a tone; activate again to stop.` : undefined
        }
        aria-disabled={isDisabled}
        aria-busy={phase === 'stopping' || (phase === 'idle' && !!disabled && !!busyLabel)}
        style={({ pressed }) => [
          styles.button,
          // Red only once the mic is really open; while getting ready it's a
          // neutral outlined button, so it never looks live before it is.
          phase === 'recording'
            ? { backgroundColor: theme.danger }
            : phase === 'starting'
              ? { backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border }
              : { backgroundColor: theme.accent },
          isDisabled && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <View style={styles.buttonInner}>
          {phase === 'starting' && <ActivityIndicator color={theme.textPrimary} />}
          {phase === 'recording' && <View style={[styles.stopSquare, { backgroundColor: theme.onAccent }]} />}
          <Text style={[styles.buttonText, { color: phase === 'starting' ? theme.textPrimary : theme.onAccent }]}>
            {phase === 'starting' ? 'Cancel' : label}
          </Text>
        </View>
      </Pressable>

      {/* Visual status only - screen reader users get the tones instead, so nothing is spoken into the mic. */}
      {phase === 'starting' && (
        <Text aria-hidden style={[styles.statusLine, { color: theme.textSecondary }]}>
          Getting the mic ready… start talking after the tone
        </Text>
      )}
      {phase === 'recording' && (
        <View aria-hidden style={styles.recordingStatus}>
          <RecordingDot color={theme.danger} />
          <Text style={[styles.recordingText, { color: theme.danger }]}>Recording, speak now</Text>
          <Text style={[styles.statusTime, { color: remaining <= 5 ? theme.danger : theme.textSecondary }]}>
            {formatSeconds(elapsed)}
            {elapsed < MIN_VOICE_NOTE_SECONDS ? ` · at least ${MIN_VOICE_NOTE_SECONDS}s` : ` · ${remaining}s left`}
          </Text>
        </View>
      )}
      {Platform.OS === 'web' && (
        <Text role="status" aria-live="polite" style={styles.srOnly}>
          {webAnnouncement}
        </Text>
      )}
    </View>
  );
}

type VoiceNotePlayerProps = {
  uri: string;
  /** Who recorded it ("you" for an unsaved recording). */
  recordedBy: string;
  durationSeconds: number;
  /** ISO timestamp; shown and read as a short date when given. */
  recordedAt?: string;
  /** "2 of 3", when the note is one of a list. */
  position?: { index: number; total: number };
  /** For moving screen reader focus onto this note (just saved). */
  focusRef?: Ref<View>;
};

/**
 * A single play/pause toggle for one recording. Its accessible name says
 * which note it is, who recorded it, when, and how long it is: "Play voice
 * note 2 of 3, by Ava, Nov 11, 12 seconds". While playing it's "Pause voice
 * note 2 of 3". The on-screen progress is hidden from screen readers so
 * nothing talks over the audio.
 *
 * Reliability notes:
 * - iOS mutes playback under the ringer's silent switch until the audio
 *   session says otherwise, so playback sets the session itself.
 * - A finished note sits at its end; pressing play rewinds it first.
 * - Safari only lets audio start from inside the tap itself, so on web
 *   `play()` is called straight away with no awaits in front of it.
 * - Starting one note pauses any other that is playing.
 */
export function VoiceNotePlayer({ uri, recordedBy, durationSeconds, recordedAt, position, focusRef }: VoiceNotePlayerProps) {
  const { theme } = useTheme();
  const player = useAudioPlayer(uri, { ...PLAYER_OPTIONS, updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  useEffect(
    () => () => {
      if (activePlayer === player) activePlayer = null;
    },
    [player],
  );

  const total = status.duration > 0 && Number.isFinite(status.duration) ? status.duration : durationSeconds;
  const atEnd = status.didJustFinish || (status.currentTime > 0 && status.currentTime >= total - 0.25);

  const play = async () => {
    if (activePlayer && activePlayer !== player) {
      try {
        activePlayer.pause();
      } catch {
        // That player was already released (its screen unmounted).
      }
    }
    activePlayer = player;

    if (Platform.OS === 'web') {
      if (atEnd) void player.seekTo(0);
      player.play();
      return;
    }
    try {
      await setAudioModeAsync(audioMode(false));
      if (atEnd) await player.seekTo(0);
      player.play();
    } catch (err) {
      showAlert("Couldn't play voice note", getErrorMessage(err, 'Something went wrong. Please try again.'));
    }
  };

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    void play();
  };

  const which = position ? `voice note ${position.index} of ${position.total}` : 'voice note';
  const date = recordedAt ? formatRecordedDate(recordedAt) : '';
  const label = status.playing
    ? `Pause ${which}`
    : `Play ${which}, by ${recordedBy}${date ? `, ${date}` : ''}, ${spokenDuration(durationSeconds)}`;
  const showProgress = status.playing || (status.currentTime > 0 && !atEnd);

  return (
    <Pressable
      ref={focusRef}
      onPress={toggle}
      role="button"
      aria-label={label}
      style={({ pressed }) => [
        styles.playButton,
        { borderColor: theme.accent, backgroundColor: theme.surface },
        pressed && styles.buttonPressed,
      ]}
    >
      <View style={styles.playButtonInner} aria-hidden>
        <Text style={[styles.playIcon, { color: theme.accent }]}>{status.playing ? '❚❚' : '▶'}</Text>
        <View style={styles.playMeta}>
          <Text style={[styles.playButtonText, { color: theme.textPrimary }]} numberOfLines={1}>
            {recordedBy}
          </Text>
          {date ? <Text style={[styles.playDate, { color: theme.textSecondary }]}>{date}</Text> : null}
        </View>
        <Text style={[styles.playTime, { color: theme.textSecondary }]}>
          {showProgress ? `${formatSeconds(status.currentTime)} / ${formatSeconds(total)}` : formatSeconds(total)}
        </Text>
      </View>
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
 * is saved and the caller uploads it. More can be added afterwards from the
 * outfit's or item's page.
 */
export function PendingVoiceNoteField({ value, onChange, disabled }: PendingVoiceNoteFieldProps) {
  const { theme } = useTheme();
  const recorderWrapperRef = useRef<View>(null);

  const discard = () => {
    if (value) revokeIfBlobUrl(value.uri);
    onChange(null);
    announceForScreenReader('Recording discarded.');
    moveScreenReaderFocus(recorderWrapperRef.current);
  };

  if (!value) {
    return (
      <View ref={recorderWrapperRef}>
        <VoiceRecorder onRecorded={onChange} disabled={disabled} />
      </View>
    );
  }

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
  /** The page's own section-heading style, so this reads as one of its sections. */
  headingStyle?: StyleProp<TextStyle>;
};

/**
 * The "Voice notes" section of an outfit or item page, like Worn in the
 * Wild: every note on it (oldest first), a delete button on the ones this
 * user may delete (their own, or any on a closet they own), and a recorder
 * that adds another straight away. Any closet member can add notes.
 *
 * Focus: after a note is saved, screen reader focus moves to it (so its name
 * - "Play voice note 3 of 3, by you, ..." - confirms what was saved); after
 * a delete, it moves to the section heading instead of being lost.
 */
export default function VoiceNotesSection({ target, closetId, headingStyle }: VoiceNotesSectionProps) {
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

  const headingRef = useRef<Text>(null);
  const noteRefs = useRef(new Map<string, View>());
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);

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

  // Runs after the new row has rendered, so its ref exists.
  useEffect(() => {
    if (!focusNoteId) return;
    moveScreenReaderFocus(noteRefs.current.get(focusNoteId), 600);
    setFocusNoteId(null);
  }, [focusNoteId, notes]);

  const handleRecorded = useCallback(
    async (recording: PendingVoiceNote) => {
      setIsUploading(true);
      try {
        const currentTarget: VoiceNoteTarget =
          targetKind === 'outfit' ? { outfitId: targetId } : { clothingItemId: targetId };
        const note = await dataService.addVoiceNote(currentTarget, closetId, recording);
        setNotes(prev => [...(prev ?? []), note]);
        setFocusNoteId(note.id);
        showToast('Voice note saved');
      } catch (err) {
        showAlert("Couldn't save voice note", getErrorMessage(err, 'Something went wrong. Please try again.'));
      } finally {
        setIsUploading(false);
      }
    },
    [dataService, targetKind, targetId, closetId, showToast],
  );

  const handleDelete = (note: VoiceNote, index: number) => {
    showAlert('Delete voice note', `Delete voice note ${index} by ${note.recorded_by}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dataService.deleteVoiceNote(note);
            noteRefs.current.delete(note.id);
            setNotes(prev => (prev ?? []).filter(candidate => candidate.id !== note.id));
            showToast('Voice note deleted');
            moveScreenReaderFocus(headingRef.current, 600);
          } catch (err) {
            showAlert("Couldn't delete voice note", getErrorMessage(err, 'Something went wrong. Please try again.'));
          }
        },
      },
    ]);
  };

  const count = notes?.length ?? 0;

  return (
    <View style={styles.section}>
      <Text
        ref={headingRef}
        role="heading"
        style={headingStyle ?? [styles.heading, { color: theme.textPrimary }]}
      >
        {/* Visible text only - no separate aria-label to drift out of sync. VoiceOver reads "Voice notes, 3". */}
        {count > 0 ? `Voice notes (${count})` : 'Voice notes'}
      </Text>

      {error ? (
        <Text style={[styles.emptyText, { color: theme.danger }]}>{error}</Text>
      ) : notes === null ? (
        <ActivityIndicator style={styles.loading} aria-label="Loading voice notes" />
      ) : notes.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No voice notes yet. Record one to talk through how it fits, feels or styles.
        </Text>
      ) : (
        notes.map((note, i) => {
          const position = { index: i + 1, total: notes.length };
          return (
            <View key={note.id} style={styles.row}>
              <VoiceNotePlayer
                uri={note.audio_url}
                recordedBy={note.created_by_user_id === userId ? 'you' : note.recorded_by}
                durationSeconds={note.duration_seconds}
                recordedAt={note.created_at}
                position={position}
                focusRef={node => {
                  if (node) noteRefs.current.set(note.id, node);
                }}
              />
              {(note.created_by_user_id === userId || isClosetOwner) && (
                <Pressable
                  onPress={() => handleDelete(note, position.index)}
                  role="button"
                  aria-label={`Delete voice note ${position.index} of ${position.total}`}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonPressed]}
                >
                  <Text style={[styles.deleteButtonText, { color: theme.danger }]}>Delete</Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}

      {!error && (
        <View style={styles.recorder}>
          <VoiceRecorder onRecorded={handleRecorded} disabled={isUploading} busyLabel="Saving voice note" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    marginBottom: 20,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
  loading: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recorder: {
    marginTop: 4,
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
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stopSquare: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  statusLine: {
    marginTop: 8,
    fontSize: 15,
    textAlign: 'center',
  },
  recordingStatus: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recordingText: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusTime: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  playButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playIcon: {
    fontSize: 16,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  playMeta: {
    flex: 1,
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  playDate: {
    fontSize: 13,
    marginTop: 2,
  },
  playTime: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
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
    marginBottom: 12,
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
