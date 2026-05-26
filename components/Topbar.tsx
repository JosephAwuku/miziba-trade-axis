"use client";

import React from 'react';
import NotificationCenter from './NotificationCenter';

interface TopbarProps {
  viewLabel: string;
  roleLabel: string;
  onOpenSidebar: () => void;
  onLogout: () => void;
  onNotify: (msg: string, type?: string) => void;
  onViewAllNotifications?: () => void;
  onOpenNotification?: (notificationId: string) => void;
  notificationRefreshToken?: number;
  searchTerm?: string;
  onSearch?: (term: string) => void;
}

const Topbar: React.FC<TopbarProps> = ({
  viewLabel,
  roleLabel,
  onOpenSidebar,
  onLogout,
  onNotify,
  onViewAllNotifications,
  onOpenNotification,
  notificationRefreshToken = 0,
  searchTerm = '',
  onSearch,
}) => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="ham-btn" onClick={onOpenSidebar} style={{ marginRight: '4px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 700, 
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>{viewLabel}</div>
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '1px', opacity: 0.7 }}>{currentDate}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div className="top-search" style={{ position: 'relative', width: '240px', display: 'flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', left: '10px', color: '#94A3B8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Search trades..." 
            value={searchTerm}
            onChange={(e) => onSearch?.(e.target.value)}
            style={{ 
              padding: '7px 10px 7px 32px', 
              fontSize: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--su-b)', // Matching brand border
              background: '#fff',
              width: '100%',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--cr)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--su-b)'}
          />
        </div>

        <NotificationCenter
          onNotify={onNotify}
          onViewAll={onViewAllNotifications}
          onOpenNotification={onOpenNotification}
          refreshToken={notificationRefreshToken}
        />

        <button onClick={onLogout} className="logout-btn-top">
          LOG OUT
        </button>
      </div>
    </div>
  );
};

export default Topbar;
