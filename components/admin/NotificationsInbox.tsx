"use client";

import React, { useEffect, useState } from 'react';
import { Notification } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { Card, Button, Badge } from '../ui';
import { timeAgo } from '@/lib/utils';
import { NotificationTypeIcon } from '@/components/notifications/NotificationTypeIcon';

interface NotificationsInboxProps {
  onNotify: (msg: string, type?: string) => void;
  onBack?: () => void;
  initialNotificationId?: string | null;
  onNotificationsChange?: () => void;
}

const notificationTimestamp = (notification: Notification) =>
  notification.sent_at || notification.created_at;

const NotificationsInbox: React.FC<NotificationsInboxProps> = ({
  onNotify,
  onBack,
  initialNotificationId = null,
  onNotificationsChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const markRead = async (id: string | 'all') => {
    const now = new Date().toISOString();
    try {
      await apiClient.markNotificationRead(id);
      setNotifications(prev => {
        if (id === 'all') {
          return prev.map(n => ({ ...n, read_at: n.read_at || now }));
        }
        return prev.map(n => (n.id === id ? { ...n, read_at: n.read_at || now } : n));
      });
      setSelected(prev => {
        if (!prev) return prev;
        if (id === 'all') {
          return { ...prev, read_at: prev.read_at || now };
        }
        if (prev.id === id) {
          return { ...prev, read_at: prev.read_at || now };
        }
        return prev;
      });
      onNotificationsChange?.();
    } catch {
      onNotify('Failed to update notification state.', 'error');
    }
  };

  const openNotification = async (notification: Notification) => {
    setSelected(notification);
    if (!notification.read_at) {
      await markRead(notification.id);
    }
  };

  const fetchNotifications = async (targetId?: string | null) => {
    try {
      setLoading(true);
      const data = await apiClient.getNotifications();
      setNotifications(data);

      const preferredId = targetId ?? initialNotificationId;
      const target = preferredId ? data.find(n => n.id === preferredId) : undefined;

      if (target) {
        await openNotification(target);
      } else if (data.length > 0) {
        setSelected(data[0]);
      } else {
        setSelected(null);
      }
    } catch (err: any) {
      onNotify(err.message || 'Failed to fetch notifications.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(initialNotificationId);
  }, [initialNotificationId]);

  const handleSelect = async (notification: Notification) => {
    await openNotification(notification);
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    await markRead('all');
    setMarkingAll(false);
  };

  if (loading) {
    return <div className="animate-pulse" style={{ padding: '20px', color: '#6B7280' }}>Loading notifications...</div>;
  }

  return (
    <div className="fade-in">
      {onBack && (
        <div style={{ marginBottom: '16px' }}>
          <div
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--cr)', fontSize: '13px', fontWeight: 800, transition: 'transform 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(-4px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            BACK TO PREVIOUS PAGE
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Notifications</h2>
          <p style={{ fontSize: '12px', color: '#6B7280' }}>Review alerts and updates across operations.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Badge variant={unreadCount > 0 ? 'warning' : 'success'}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
          </Badge>
          <Button variant="secondary" size="sm" onClick={handleMarkAll} disabled={unreadCount === 0 || markingAll}>
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </Button>
        </div>
      </div>

      <div className="g2" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px', alignItems: 'start' }}>
        <Card title={`INBOX (${notifications.length})`}>
          {notifications.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
              No notifications to show.
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`list-item ${selected?.id === n.id ? 'active' : ''}`}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #F3F4F6',
                    borderLeft: n.read_at ? 'none' : '3px solid var(--cr)',
                    cursor: 'pointer',
                    background: selected?.id === n.id ? '#F8FAFC' : (n.read_at ? 'transparent' : 'rgba(139, 0, 0, 0.02)'),
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleSelect(n)}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: n.read_at ? '#F3F4F6' : 'var(--cr-bg)',
                      color: n.read_at ? '#9CA3AF' : 'var(--cr)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      opacity: n.read_at ? 0.6 : 1,
                    }}>
                      <NotificationTypeIcon notification={n} size={16} strokeWidth={2} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: n.read_at ? 600 : 800,
                          color: n.read_at ? '#6B7280' : '#111827',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {!n.read_at && (
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--cr)',
                              display: 'inline-block',
                              flexShrink: 0
                            }} />
                          )}
                          {n.subject}
                        </div>
                        {!n.read_at && <Badge variant="danger">NEW</Badge>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', opacity: n.read_at ? 0.7 : 1 }}>
                        {timeAgo(notificationTimestamp(n) || new Date().toISOString())}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {selected ? (
          <Card key={selected.id} className="fade-in">
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{selected.subject}</h3>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                    {notificationTimestamp(selected)
                      ? new Date(notificationTimestamp(selected)!).toLocaleString()
                      : 'Just now'}
                  </div>
                </div>
                <Badge variant={selected.read_at ? 'default' : 'warning'}>
                  {selected.read_at ? 'Read' : 'Unread'}
                </Badge>
              </div>
              <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selected.body}
              </div>
            </div>
          </Card>
        ) : (
          <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', border: '2px dashed #E5E7EB', borderRadius: '12px', color: '#9CA3AF', fontSize: '14px' }}>
            Select a notification from the list to view details
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsInbox;
