"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { apiClient } from '@/lib/api';

interface VerificationStatus {
  canSubmitTrades: boolean;
  kycStatus: string;
  isLoading: boolean;
  lastChecked: number | null;
}

interface TraderVerificationContextType extends VerificationStatus {
  refetchVerification: () => Promise<void>;
}

const TraderVerificationContext = createContext<TraderVerificationContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const TraderVerificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<VerificationStatus>({
    canSubmitTrades: false,
    kycStatus: 'PENDING',
    isLoading: true,
    lastChecked: null,
  });

  const lastCheckedRef = useRef<number | null>(null);

  const fetchVerification = useCallback(async () => {
    try {
      const profile = await apiClient.getTraderProfile();
      const checkedAt = Date.now();
      lastCheckedRef.current = checkedAt;
      setState({
        canSubmitTrades: profile.can_submit_trades === true || profile.is_fully_verified === true,
        kycStatus: profile.kyc_status || 'PENDING',
        isLoading: false,
        lastChecked: checkedAt,
      });
    } catch (error) {
      console.error('Failed to fetch trader verification:', error);
      const checkedAt = Date.now();
      lastCheckedRef.current = checkedAt;
      setState(prev => ({
        ...prev,
        canSubmitTrades: false,
        kycStatus: 'PENDING',
        isLoading: false,
        lastChecked: checkedAt,
      }));
    }
  }, []);

  const refetchVerification = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await fetchVerification();
  }, [fetchVerification]);

  useEffect(() => {
    let cancelled = false;

    const runFetch = () => {
      if (!cancelled) {
        void fetchVerification();
      }
    };

    queueMicrotask(runFetch);

    const interval = setInterval(() => {
      const last = lastCheckedRef.current;
      if (!last || Date.now() - last > CACHE_DURATION) {
        runFetch();
      }
    }, CACHE_DURATION);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchVerification]);

  return (
    <TraderVerificationContext.Provider value={{ ...state, refetchVerification }}>
      {children}
    </TraderVerificationContext.Provider>
  );
};

export const useTraderVerification = () => {
  const context = useContext(TraderVerificationContext);
  if (context === undefined) {
    throw new Error('useTraderVerification must be used within TraderVerificationProvider');
  }
  return context;
};
