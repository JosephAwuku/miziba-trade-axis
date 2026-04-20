"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Notification } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { Button } from './ui';

interface NotificationCenterProps {
  onNotify: (msg: string, type?: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNotify }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Close on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) fetchNotifications();
  };

  const markRead = async (id: string | 'all') => {
    try {
      await apiClient.markNotificationRead(id);
      if (id === 'all') {
        setNotifications(notifications.map(n => ({ ...n, read_at: new Date().toISOString() })));
      } else {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      }
    } catch (err) {
      onNotify('Failed to update notification', 'error');
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        style={{
          background: unreadCount > 0 ? 'var(--cr-bg)' : '#F9FAFB',
          border: `1px solid ${unreadCount > 0 ? 'var(--cr-b)' : '#E5E7EB'}`,
          color: unreadCount > 0 ? 'var(--cr)' : '#6B7280',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          position: 'relative',
          transition: 'all 0.2s'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
        </svg>
        
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: 'var(--cr)',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 800,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
            boxShadow: '0 2px 4px rgba(139, 0, 0, 0.2)'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '40px',
          right: 0,
          width: '320px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1)',
          border: '1px solid #E5E7EB',
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }} className="fade-in">
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={() => markRead('all')}
                style={{ background: 'none', border: 'none', color: 'var(--cr)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', background: '#fff' }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>All clear!</div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>No new notifications to show.</div>
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => markRead(n.id)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #F9FAFB',
                    cursor: 'pointer',
                    background: n.read_at ? '#fff' : 'rgba(139, 0, 0, 0.02)',
                    transition: 'background 0.2s',
                    display: 'flex',
                    gap: '12px'
                  }}
                  className="row-hover"
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: n.read_at ? '#F3F4F6' : 'var(--cr-bg)',
                    color: n.read_at ? '#9CA3AF' : 'var(--cr)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '18px'
                  }}>
                    {n.subject.includes('Trade') ? '📦' : n.subject.includes('Finance') ? '💰' : '🔔'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ 
                        fontSize: '12px', 
                        fontWeight: n.read_at ? 600 : 800, 
                        color: '#111827',
                        lineHeight: 1.4
                      }}>{n.subject}</div>
                      <div style={{ fontSize: '10px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                        {n.sent_at ? timeAgo(n.sent_at) : 'now'}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#6B7280', 
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.5
                    }}>{n.body}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ 
            padding: '12px', 
            borderTop: '1px solid #F3F4F6',
            textAlign: 'center',
            background: '#F9FAFB'
          }}>
             <button style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '11px', fontWeight: 600, cursor: 'default' }}>
               Powered by TradeAxis Real-time
             </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .row-hover:hover {
          background: #F9FAFB !important;
        }
      `}</style>
    </div>
  );
};

export default NotificationCenter;
