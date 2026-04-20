"use client";

import React from 'react';
import NotificationCenter from './NotificationCenter';

interface TopbarProps {
  viewLabel: string;
  roleLabel: string;
  onOpenSidebar: () => void;
  onLogout: () => void;
  onNotify: (msg: string, type?: string) => void;
}

const Topbar: React.FC<TopbarProps> = ({ viewLabel, roleLabel, onOpenSidebar, onLogout, onNotify }) => {
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
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
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
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <NotificationCenter onNotify={onNotify} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: '#F0FDF4',
          border: '1px solid #DCFCE7',
          color: '#166534',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600
        }}>
          <span style={{ color: '#22C55E', fontSize: '14px', lineHeight: 1 }}>●</span> Live
        </div>



        <button 
          onClick={onLogout}
          style={{ 
            background: '#FEF2F2', 
            color: '#EF4444', 
            border: '1px solid #FEE2E2',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            marginLeft: '4px'
          }}
        >
          LOG OUT
        </button>
      </div>
    </div>
  );
};

export default Topbar;
