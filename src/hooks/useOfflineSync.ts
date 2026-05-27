import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Document, ReadingMetrics } from '../types';
import DataService from '../services/storage/DataService';
import { logger } from '../services/logger/Logger';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState<{
    documents: Document[];
    metrics: ReadingMetrics[];
  }>({
    documents: [],
    metrics: [],
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOnline) {
      void DataService.syncNow();
    }
  }, [isOnline]);

  const queueDocument = useCallback((document: Document) => {
    setPendingSync((prev) => ({
      ...prev,
      documents: [...prev.documents, document],
    }));
  }, []);

  const queueMetrics = useCallback((metrics: ReadingMetrics) => {
    setPendingSync((prev) => ({
      ...prev,
      metrics: [...prev.metrics, metrics],
    }));
  }, []);

  const syncPendingData = useCallback(async () => {
    if (!isOnline) {
      return;
    }
    try {
      for (const doc of pendingSync.documents) {
        await DataService.saveDocument(doc);
      }
      for (const metric of pendingSync.metrics) {
        await DataService.saveReadingMetrics(metric);
      }
      await DataService.syncNow();
      setPendingSync({ documents: [], metrics: [] });
    } catch (error) {
      logger.error('Sync error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [isOnline, pendingSync]);

  return {
    isOnline,
    pendingSync,
    queueDocument,
    queueMetrics,
    syncPendingData,
  };
};
