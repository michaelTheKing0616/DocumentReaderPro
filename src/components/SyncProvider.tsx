import React from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';

interface SyncProviderProps {
  children: React.ReactNode;
}

/** Mounts offline sync lifecycle (network restore → DataService.syncNow). */
export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  useOfflineSync();
  return <>{children}</>;
};
