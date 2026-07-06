import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDataService, type DataMode, type IDataService } from '@/services/dataService';

const STORAGE_KEY = 'zeeba.dataMode';
const DEFAULT_MODE: DataMode = 'live';

type DataModeContextValue = {
  mode: DataMode;
  dataService: IDataService;
  setMode: (mode: DataMode) => void;
  toggleMode: () => void;
};

const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>(DEFAULT_MODE);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (!cancelled && (stored === 'live' || stored === 'preview')) setModeState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (nextMode: DataMode) => {
    setModeState(nextMode);
    AsyncStorage.setItem(STORAGE_KEY, nextMode).catch(() => {});
  };

  const value = useMemo<DataModeContextValue>(
    () => ({
      mode,
      dataService: getDataService(mode),
      setMode,
      toggleMode: () => setMode(mode === 'live' ? 'preview' : 'live'),
    }),
    [mode],
  );

  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

/** The single entry point UI code uses to read/switch data source and fetch data. */
export function useDataMode(): DataModeContextValue {
  const context = useContext(DataModeContext);
  if (!context) throw new Error('useDataMode must be used within a DataModeProvider');
  return context;
}
