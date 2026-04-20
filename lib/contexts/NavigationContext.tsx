"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

interface NavigationContextType {
  isBlocked: boolean;
  setBlocked: (blocked: boolean) => void;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
  requestNavigation: (targetView: string, callback: (view: any) => void) => void;
  showConfirm: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBlocked, setBlocked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ view: string; cb: (view: any) => void } | null>(null);

  const requestNavigation = useCallback((targetView: string, callback: (view: any) => void) => {
    if (isBlocked) {
      setPendingAction({ view: targetView, cb: callback });
      setShowConfirm(true);
    } else {
      callback(targetView);
    }
  }, [isBlocked]);

  const confirmNavigation = useCallback(() => {
    if (pendingAction) {
      setBlocked(false);
      setShowConfirm(false);
      pendingAction.cb(pendingAction.view);
      setPendingAction(null);
    }
  }, [pendingAction]);

  const cancelNavigation = useCallback(() => {
    setShowConfirm(false);
    setPendingAction(null);
  }, []);

  return (
    <NavigationContext.Provider value={{ 
      isBlocked, 
      setBlocked, 
      confirmNavigation, 
      cancelNavigation, 
      requestNavigation,
      showConfirm 
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
