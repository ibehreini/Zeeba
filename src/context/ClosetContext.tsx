import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDataMode } from '@/context/DataModeContext';
import { getErrorMessage, type OwnCloset, type StylistCloset } from '@/services/dataService.types';

export type ClosetMode = 'stylist' | 'my-closet';

type ClosetContextValue = {
  closetMode: ClosetMode;
  setClosetMode: (mode: ClosetMode) => void;
  /** The closet the Closet/Outfits tabs should display, resolved from closetMode. */
  activeClosetId: string | null;
  activeClosetName: string | null;
  stylistClosets: StylistCloset[] | null;
  selectStylistCloset: (closetId: string) => void;
  isLoading: boolean;
  error: string | null;
  /** True once the user's own-closet lookup has finished and come back empty - show the creation form. */
  needsOwnClosetSetup: boolean;
  /** Only ever set once the user owns a closet - null while loading or mid-setup. */
  ownClosetPassphrase: string | null;
  createOwnCloset: (closetName: string) => Promise<void>;
  regeneratePassphrase: () => Promise<void>;
  /** Joins a closet by passphrase (stylist flow) and makes it the active stylist closet. Returns its name, or throws on an invalid passphrase. */
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
  // 'live' mode needs a real signed-in user id before it can query Supabase;
  // 'preview' mode (guests) ignores the id entirely, so it's never blocked.
  const waitingForSession = mode === 'live' && (initializing || !session);

  const [closetMode, setClosetMode] = useState<ClosetMode>('my-closet');

  const [myCloset, setMyCloset] = useState<OwnCloset | null>(null);
  // Distinguishes "still loading" (myCloset null, not checked yet) from
  // "loaded but the user has no closet yet" (myCloset null, checked) - the
  // latter is what should show the creation form instead of a spinner.
  const [myClosetChecked, setMyClosetChecked] = useState(false);
  const [myClosetError, setMyClosetError] = useState<string | null>(null);

  const [stylistClosets, setStylistClosets] = useState<StylistCloset[] | null>(null);
  const [stylistError, setStylistError] = useState<string | null>(null);
  const [selectedStylistClosetId, setSelectedStylistClosetId] = useState<string | null>(null);

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

  useEffect(() => {
    if (closetMode !== 'my-closet' || waitingForSession) return;

    let cancelled = false;
    setMyCloset(null);
    setMyClosetChecked(false);
    setMyClosetError(null);
    const ticket = startLabelsRequest();

    dataService
      .getOwnCloset(userId)
      .then(closet => {
        if (cancelled) return;
        setMyCloset(closet);
        setMyClosetChecked(true);
        if (closet) applyClosetLabels(closet.closet_id, closet.outfit_labels, ticket);
      })
      .catch(err => {
        if (cancelled) return;
        setMyClosetError(getErrorMessage(err, 'Failed to load your closet.'));
        setMyClosetChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [closetMode, dataService, userId, waitingForSession, startLabelsRequest, applyClosetLabels]);

  useEffect(() => {
    if (closetMode !== 'stylist' || waitingForSession) return;

    let cancelled = false;
    setStylistClosets(null);
    setStylistError(null);
    setSelectedStylistClosetId(null);
    const ticket = startLabelsRequest();

    dataService
      .getStylistClosets(userId)
      .then(closets => {
        if (cancelled) return;
        setStylistClosets(closets);
        for (const closet of closets) applyClosetLabels(closet.closet_id, closet.outfit_labels, ticket);
      })
      .catch(err => {
        if (!cancelled) setStylistError(getErrorMessage(err, 'Failed to load closets.'));
      });

    return () => {
      cancelled = true;
    };
  }, [closetMode, dataService, userId, waitingForSession, startLabelsRequest, applyClosetLabels]);

  // Defaults to the first stylist closet until one is explicitly selected.
  const activeCloset =
    closetMode === 'my-closet'
      ? myCloset
      : (stylistClosets?.find(closet => closet.closet_id === selectedStylistClosetId) ?? stylistClosets?.[0] ?? null);

  const needsOwnClosetSetup = closetMode === 'my-closet' && myClosetChecked && !myCloset && !myClosetError;
  const activeClosetId = activeCloset?.closet_id ?? null;
  const activeClosetLabels =
    (activeClosetId ? labelsByCloset[activeClosetId]?.labels : null) ?? activeCloset?.outfit_labels ?? NO_LABELS;

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
    setMyClosetChecked(true);
    setMyClosetError(null);
  };

  const regeneratePassphrase = async () => {
    if (!myCloset) return;
    const newPhrase = await dataService.regeneratePassphrase(myCloset.closet_id);
    setMyCloset({ ...myCloset, pass_phrase: newPhrase });
  };

  const joinCloset = async (passphrase: string): Promise<string> => {
    const trimmed = passphrase.trim();
    if (!trimmed) throw new Error('Enter a passphrase.');
    const joined = await dataService.joinClosetByPassphrase(trimmed);
    setStylistClosets(prev => {
      const existing = prev ?? [];
      return existing.some(closet => closet.closet_id === joined.closet_id) ? existing : [...existing, joined];
    });
    applyClosetLabels(joined.closet_id, joined.outfit_labels);
    setSelectedStylistClosetId(joined.closet_id);
    return joined.closet_name;
  };

  const value = useMemo<ClosetContextValue>(
    () => ({
      closetMode,
      setClosetMode,
      activeClosetId,
      activeClosetName: activeCloset?.closet_name ?? null,
      stylistClosets,
      selectStylistCloset: setSelectedStylistClosetId,
      isLoading:
        closetMode === 'my-closet' ? !myClosetChecked && !myClosetError : !stylistClosets && !stylistError,
      error: closetMode === 'my-closet' ? myClosetError : stylistError,
      needsOwnClosetSetup,
      ownClosetPassphrase: myCloset?.pass_phrase ?? null,
      createOwnCloset,
      regeneratePassphrase,
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
      stylistClosets,
      myCloset,
      myClosetChecked,
      myClosetError,
      stylistError,
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
