import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
};

const ClosetContext = createContext<ClosetContextValue | null>(null);

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

  useEffect(() => {
    if (closetMode !== 'my-closet' || waitingForSession) return;

    let cancelled = false;
    setMyCloset(null);
    setMyClosetChecked(false);
    setMyClosetError(null);

    dataService
      .getOwnCloset(userId)
      .then(closet => {
        if (cancelled) return;
        setMyCloset(closet);
        setMyClosetChecked(true);
      })
      .catch(err => {
        if (cancelled) return;
        setMyClosetError(getErrorMessage(err, 'Failed to load your closet.'));
        setMyClosetChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [closetMode, dataService, userId, waitingForSession]);

  useEffect(() => {
    if (closetMode !== 'stylist' || waitingForSession) return;

    let cancelled = false;
    setStylistClosets(null);
    setStylistError(null);
    setSelectedStylistClosetId(null);

    dataService
      .getStylistClosets(userId)
      .then(closets => {
        if (!cancelled) setStylistClosets(closets);
      })
      .catch(err => {
        if (!cancelled) setStylistError(getErrorMessage(err, 'Failed to load closets.'));
      });

    return () => {
      cancelled = true;
    };
  }, [closetMode, dataService, userId, waitingForSession]);

  // Defaults to the first stylist closet until one is explicitly selected.
  const activeCloset =
    closetMode === 'my-closet'
      ? myCloset
      : (stylistClosets?.find(closet => closet.closet_id === selectedStylistClosetId) ?? stylistClosets?.[0] ?? null);

  const needsOwnClosetSetup = closetMode === 'my-closet' && myClosetChecked && !myCloset && !myClosetError;

  const createOwnCloset = async (closetName: string) => {
    const trimmed = closetName.trim();
    if (!trimmed) throw new Error('Give your closet a name.');
    const created = await dataService.createOwnCloset(userId, trimmed);
    setMyCloset(created);
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
    setSelectedStylistClosetId(joined.closet_id);
    return joined.closet_name;
  };

  const value = useMemo<ClosetContextValue>(
    () => ({
      closetMode,
      setClosetMode,
      activeClosetId: activeCloset?.closet_id ?? null,
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
    }),
    [
      closetMode,
      activeCloset,
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
