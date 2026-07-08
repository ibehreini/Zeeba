import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getDataService, type DataMode, type IDataService } from '@/services/dataService';

type DataModeContextValue = {
  mode: DataMode;
  dataService: IDataService;
};

const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({ children }: { children: ReactNode }) {
  const { isGuest } = useAuth();
  const mode: DataMode = isGuest ? 'preview' : 'live';

  const value = useMemo<DataModeContextValue>(
    () => ({ mode, dataService: getDataService(mode) }),
    [mode],
  );

  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

/** The single entry point UI code uses to read the data source and fetch data. */
export function useDataMode(): DataModeContextValue {
  const context = useContext(DataModeContext);
  if (!context) throw new Error('useDataMode must be used within a DataModeProvider');
  return context;
}
