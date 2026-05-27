"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './ui';

interface SessionTimerProps {
  onSessionExpired: () => void;
  onExtendSession: () => void;
}

export const SessionTimer: React.FC<SessionTimerProps> = ({ onSessionExpired, onExtendSession }) => {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const updateExpiry = () => {
      const session = localStorage.getItem('tradeaxis_session');
      if (session) {
        try {
          const { expires_at } = JSON.parse(session);
          if (expires_at) {
            setExpiresAt(new Date(expires_at).getTime());
          }
        } catch {}
      }
    };

    updateExpiry();
    const storageListener = () => updateExpiry();
    window.addEventListener('storage', storageListener);

    return () => window.removeEventListener('storage', storageListener);
  }, []);

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = expiresAt - now;

      if (remaining <= 0) {
        setTimeRemaining(0);
        setShowWarning(false);
        onSessionExpired();
        return;
      }

      setTimeRemaining(remaining);

      if (remaining <= 5 * 60 * 1000 && !showWarning) {
        setShowWarning(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, showWarning, onSessionExpired]);

  const handleExtend = async () => {
    setShowWarning(false);
    await onExtendSession();
    
    const session = localStorage.getItem('tradeaxis_session');
    if (session) {
      try {
        const { expires_at } = JSON.parse(session);
        if (expires_at) {
          setExpiresAt(new Date(expires_at).getTime());
        }
      } catch {}
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  if (!timeRemaining) return null;

  const isUrgent = timeRemaining <= 2 * 60 * 1000;

  return (
    <>
      {showWarning && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '400px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ margin: '0 auto' }}
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '12px',
                textAlign: 'center',
              }}
            >
              Session Expiring Soon
            </h3>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text2)',
                marginBottom: '24px',
                textAlign: 'center',
                lineHeight: 1.6,
              }}
            >
              Your session will expire in <strong>{formatTime(timeRemaining)}</strong>. Would you like to continue working?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowWarning(false);
                  onSessionExpired();
                }}
                style={{ flex: 1 }}
              >
                Log Out
              </Button>
              <Button variant="primary" onClick={handleExtend} style={{ flex: 1 }}>
                Continue Session
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        className="session-timer-float"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: isUrgent ? '#FEF3C7' : '#F3F4F6',
          border: `1px solid ${isUrgent ? '#F59E0B' : '#E5E7EB'}`,
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 600,
          color: isUrgent ? '#92400E' : '#6B7280',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Session: {formatTime(timeRemaining)}
      </div>
    </>
  );
};
