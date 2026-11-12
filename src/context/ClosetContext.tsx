import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDataMode } from '@/context/DataModeContext';
import { getErrorMessage, type OwnCloset, type StylistCloset } from '@/services/dataService.types';

export type ClosetMode = 'stylist' | 'my-closet';

type ClosetContextValue = {
  /** Derived from the selection: 'my-closet' while the user's own closet is selected, else 'stylist'. */
  closetMode: ClosetMode;
  /** Selects a closet the user styles by id, or their own closet with null. */
  selectCloset: (stylistClosetId: string | null) => void;
  /** The closet the Closet/Outfits tabs should display. */
  activeClosetId: string | null;
  activeClosetName: string | null;
  /** The user's own closet's name, whichever closet is selected - null while loading or not set up. */
  ownClosetName: string | null;
  stylistClosets: StylistCloset[] | null;
  /** The selected closet is still loading. */
  isLoading: boolean;
  /** Why the selected closet couldn't load. */
  error: string | null;
  /** Either closet list (own or styled) is still loading - for Home, which lists both. */
  isLoadingClosets: boolean;
  /** Why either closet list couldn't load - for Home, which lists both. */
  closetsError: string | null;
  /** Re-reads both closet lists in the background (Home calls this on focus); failures keep the last good data. */
  refreshClosets: () => void;
  /** True once the user's own-closet lookup came back empty, whichever closet is selected - with closetMode 'my-closet', show the creation form. */
  needsOwnClosetSetup: boolean;
  /** Only ever set once the user owns a closet - null while loading or mid-setup. */
  ownClosetPassphrase: string | null;
  createOwnCloset: (closetName: string) => Promise<void>;
  /** Joins a closet by passphrase (stylist flow) and selects it. Returns its name, or throws on an invalid passphrase. */
  joinCloset: (passphrase: string) => Promise<string>;
  /** Outfit tags of the active closet, in display order - what the Outfits filter and the outfit forms offer. Stylists get the owner's list read-only. Empty while no closet is active. */
  activeClosetLabels: readonly string[];
  /**
   * Replaces the cached tag list of `closetId` (after Settings > Edit tags
   * saved a change, or after a fresh read), so the Outfits filter and an open
   * outfit form update without a refetch. Pass the `ticket` from
   * startLabelsRequest() when the list comes from a read; omit it for the
   * result of a write.
   */
  applyClosetLabels: (closetId: string, labels: string[], ticket?: number) => void;
  /** Takes a ticket before reading a tag list - see applyClosetLabels. */
  startLabelsRequest: () => number;
  /** Re-reads the active closet's tags (Outfits and Create outfit call this on focus) so a stylist, or the owner's other device, sees edits made elsewhere. Failures keep the last good list. */
  refreshActiveClosetLabels: () => void;
};

const ClosetContext = createContext<ClosetContextValue | null>(null);

/** Stable empty list, so consumers' memos and effects don't re-run while no closet is active. */
const NO_LABELS: readonly string[] = [];

type LabelsEntry = { labels: string[]; ticket: number };

export function ClosetProvider({ children }: { children: ReactNode }) {
  const { dataService, mode } = useDataMode();
  const { session, initializing } = useAuth();
  const userId = session?.user.id ?? '';
  // Per user, so a shared device doesn't hand one account's choice to another.
  const storageKey = `zeeba.closet-selection.${userId || 'guest'}`;
  // Which key's saved choice has been read back. Nothing is fetched or saved
  // until it matches, so a restored stylist closet never flashes My Closet.
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const restored = restoredKey === storageKey;
  // 'live' mode needs a real signed-in user id before it can query Supabase;
  // 'preview' mode (guests) ignores the id entirely, so it's never blocked.
  // Both also wait for the saved closet choice to be read back.
  const waitingForSession = (mode === 'live' && (initializing || !session)) || !restored;

  // undefined = not checked yet, null = checked and the user has no closet.
  const [myCloset, setMyCloset] = useState<OwnCloset | null | undefined>(undefined);
  const [myClosetError, setMyClosetError] = useState<string | null>(null);
  const [stylistClosets, setStylistClosets] = useState<StylistCloset[] | null>(null);
  const [stylistError, setStylistError] = useState<string | null>(null);
  // null = the user's own closet.
  const [selectedStylistClosetId, setSelectedStylistClosetId] = useState<string | null>(null);
  // Bumped when the user or data source changes, so their in-flight loads are dropped.
  const generation = useRef(0);

  // Latest known tag list per closet id. Closet loads, tag refreshes and tag
  // edits all land here, and each carries a ticket: a read takes one when it
  // starts, a write when it finishes. An entry is only replaced by a higher
  // ticket, so a closet load that started before an edit can never put the
  // pre-edit list back when it resolves late.
  const [labelsByCloset, setLabelsByCloset] = useState<Record<string, LabelsEntry>>({});
  const labelsTicket = useRef(0);

  const startLabelsRequest = useCallback(() => ++labelsTicket.current, []);

  const applyClosetLabels = useCallback((closetId: string, labels: string[], ticket?: number) => {
    const effectiveTicket = ticket ?? ++labelsTicket.current;
    setLabelsByCloset(prev => {
      const current = prev[closetId];
      if (current && current.ticket > effectiveTicket) return prev;
      return { ...prev, [closetId]: { labels, ticket: effectiveTicket } };
    });
  }, []);

  // A different user or data source: forget the previous one's closets and
  // restore this user's last selection (same best-effort AsyncStorage pattern
  // as ThemeContext). The older { mode, stylistClosetId } shape still reads.
  // A saved closet the user has since lost access to falls back to their own
  // (see closetMode below).
  useEffect(() => {
    let cancelled = false;
    generation.current++;
    setRestoredKey(null);
    setMyCloset(undefined);
    setMyClosetError(null);
    setStylistClosets(null);
    setStylistError(null);
    setSelectedStylistClosetId(null);
    AsyncStorage.getItem(storageKey)
      .then(raw => {
        const saved = raw ? JSON.parse(raw) : null;
        if (cancelled || saved?.mode === 'my-closet') return;
        if (typeof saved?.stylistClosetId === 'string') setSelectedStylistClosetId(saved.stylistClosetId);
      })
      .catch(() => {
        // Unreadable storage just means starting on My Closet.
      })
      .finally(() => {
        if (!cancelled) setRestoredKey(storageKey);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey, dataService]);

  useEffect(() => {
    if (!restored) return;
    AsyncStorage.setItem(storageKey, JSON.stringify({ stylistClosetId: selectedStylistClosetId })).catch(() => {
      // Best-effort; the in-memory choice already applied.
    });
  }, [restored, storageKey, selectedStylistClosetId]);

  // Loads both lists, so Home can list every closet and switching between
  // them never waits. A quiet (background) refresh that fails keeps whatever
  // was there - data or the earlier error - instead of blocking the screens.
  const loadClosets = useCallback(
    (quiet: boolean) => {
      const loadGeneration = generation.current;
      const stale = () => loadGeneration !== generation.current;
      const ticket = startLabelsRequest();

      dataService.getOwnCloset(userId).then(
        closet => {
          if (stale()) return;
          setMyCloset(closet);
          setMyClosetError(null);
          if (closet) applyClosetLabels(closet.closet_id, closet.outfit_labels, ticket);
        },
        err => {
          if (!stale() && !quiet) setMyClosetError(getErrorMessage(err, 'Failed to load your closet.'));
        },
      );

      dataService.getStylistClosets(userId).then(
        closets => {
          if (stale()) return;
          setStylistClosets(closets);
          setStylistError(null);
          for (const closet of closets) applyClosetLabels(closet.closet_id, closet.outfit_labels, ticket);
        },
        err => {
          if (!stale() && !quiet) setStylistError(getErrorMessage(err, 'Failed to load closets you style.'));
        },
      );
    },
    [dataService, userId, startLabelsRequest, applyClosetLabels],
  );

  useEffect(() => {
    if (!waitingForSession) loadClosets(false);
  }, [waitingForSession, loadClosets]);

  const refreshClosets = useCallback(() => {
    if (!waitingForSession) loadClosets(true);
  }, [waitingForSession, loadClosets]);

  const selectedStylistCloset = selectedStylistClosetId
    ? stylistClosets?.find(closet => closet.closet_id === selectedStylistClosetId)
    : undefined;
  // A selected stylist closet stays selected while its list loads (or failed
  // to load); once loaded, one the user is no longer on falls back to their own.
  const closetMode: ClosetMode =
    selectedStylistCloset || (selectedStylistClosetId && !stylistClosets) ? 'stylist' : 'my-closet';
  const activeCloset = (closetMode === 'my-closet' ? myCloset : selectedStylistCloset) ?? null;

  const needsOwnClosetSetup = myCloset === null;
  const activeClosetId = activeCloset?.closet_id ?? null;
  const activeClosetLabels =
    (activeClosetId ? labelsByCloset[activeClosetId]?.labels : null) ?? activeCloset?.outfit_labels ?? NO_LABELS;

  const ownLoading = myCloset === undefined && !myClosetError;
  const stylistLoading = !stylistClosets && !stylistError;
  const closetsError =
    [...new Set([myClosetError, stylistError].filter((message): message is string => !!message))].join(' ') || null;

  const refreshActiveClosetLabels = useCallback(() => {
    if (!activeClosetId) return;
    const ticket = startLabelsRequest();
    dataService
      .getClosetOutfitLabels(activeClosetId)
      .then(labels => applyClosetLabels(activeClosetId, labels, ticket))
      // Not worth an error on screen: the list already shown came from the
      // closet load moments ago, and the next focus tries again.
      .catch(() => {});
  }, [activeClosetId, dataService, startLabelsRequest, applyClosetLabels]);

  const createOwnCloset = async (closetName: string) => {
    const trimmed = closetName.trim();
    if (!trimmed) throw new Error('Give your closet a name.');
    const created = await dataService.createOwnCloset(userId, trimmed);
    setMyCloset(created);
    applyClosetLabels(created.closet_id, created.outfit_labels);
    setMyClosetError(null);
  };

  const joinCloset = async (passphrase: string): Promise<string> => {
    const trimmed = passphrase.trim();
    if (!trimmed) throw new Error('Enter a passphrase.');
    const joined = await dataService.joinClosetByPassphrase(trimmed);
    setStylistClosets(prev => {
      const existing = prev ?? [];
      return existing.some(closet => closet.closet_id === joined.closet_id) ? existing : [...existing, joined];
    });
    setStylistError(null);
    applyClosetLabels(joined.closet_id, joined.outfit_labels);
    setSelectedStylistClosetId(joined.closet_id);
    return joined.closet_name;
  };

  const value = useMemo<ClosetContextValue>(
    () => ({
      closetMode,
      selectCloset: setSelectedStylistClosetId,
      activeClosetId,
      activeClosetName: activeCloset?.closet_name ?? null,
      ownClosetName: myCloset?.closet_name ?? null,
      stylistClosets,
      isLoading: closetMode === 'my-closet' ? ownLoading : stylistLoading,
      error: closetMode === 'my-closet' ? myClosetError : stylistError,
      isLoadingClosets: ownLoading || stylistLoading,
      closetsError,
      refreshClosets,
      needsOwnClosetSetup,
      ownClosetPassphrase: myCloset?.pass_phrase ?? null,
      createOwnCloset,
      joinCloset,
      activeClosetLabels,
      applyClosetLabels,
      startLabelsRequest,
      refreshActiveClosetLabels,
    }),
    [
      closetMode,
      activeCloset,
      activeClosetId,
      activeClosetLabels,
      applyClosetLabels,
      startLabelsRequest,
      refreshActiveClosetLabels,
      refreshClosets,
      stylistClosets,
      myCloset,
      myClosetError,
      stylistError,
      ownLoading,
      stylistLoading,
      closetsError,
      needsOwnClosetSetup,
      userId,
      dataService,
    ],
  );

  return <ClosetContext.Provider value={value}>{children}</ClosetContext.Provider>;
}

/** The single entry point UI code uses to read/set which closet is active. */
export function useCloset(): ClosetContextValue {
  const context = useContext(ClosetContext);
  if (!context) throw new Error('useCloset must be used within a ClosetProvider');
  return context;
}
