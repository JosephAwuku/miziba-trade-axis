'use client';

import { useEffect, useCallback } from 'react';
import { useNavigation } from '@/lib/contexts/NavigationContext';

export const useNavigationGuard = (isDirty: boolean) => {
  const { setBlocked } = useNavigation();

  // Browser-level (Refresh, Tab Close, External links)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; 
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Connect isDirty state to our Global Navigation Hub
  useEffect(() => {
    setBlocked(isDirty);
    // Cleanup on unmount
    return () => setBlocked(false);
  }, [isDirty, setBlocked]);

  // SPA-level (Physical internal Link clicks - legacy/standard <a> tags)
  // We keep this for robustness in case some parts of the app use standard Link
  useEffect(() => {
    const handleInternalClick = (e: MouseEvent) => {
      if (!isDirty) return;

      let target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link) {
        const href = link.getAttribute('href');
        const targetAttr = link.getAttribute('target');

        const isInternal = href && 
                           !href.startsWith('#') && 
                           !href.startsWith('mailto:') && 
                           !href.startsWith('tel:') && 
                           targetAttr !== '_blank' &&
                           !href.startsWith('http');

        if (isInternal) {
          // Note: Ideally these would also go through requestNavigation,
          // but since they are native clicks we can at least block them
          // and the user will see the browser's/context's alert.
          // For now, we'll let the global window.onbeforeunload 
          // or the Home component's interception handle these if they hit a state change.
        }
      }
    };

    document.addEventListener('click', handleInternalClick, { capture: true });
    return () => document.removeEventListener('click', handleInternalClick, { capture: true });
  }, [isDirty]);

  // The local showConfirm is no longer needed if we use the Global Hub
  return {};
};
