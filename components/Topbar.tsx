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
        <button className="ham-btn" onClick={onOpenSidebar}>☰</button>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>{viewLabel}</div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '1px' }}>{currentDate}</div>
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

        <div style={{
          background: '#F0FDF4',
          border: '1px solid #DCFCE7',
          color: '#166534',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600
        }}>
          {roleLabel}
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
