"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import { apiClient } from '@/lib/api';

const UserDirectory: React.FC<{ onNotify: (m: string, t?: string) => void }> = ({ onNotify }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Assuming a generic endpoint for users/directory
      // For now, mirroring what we might get from a users query
      const response = await apiClient.getUsers(); 
      setUsers(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      onNotify('Failed to synchronize user directory. Please check your session.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roles: any = {
      ceo: { label: 'CEO', bg: '#FEE2E2', color: '#B91C1C' },
      cfo: { label: 'CFO', bg: '#FEF3C7', color: '#92400E' },
      deal_officer: { label: 'Officer', bg: '#DBEAFE', color: '#1E40AF' },
      trader: { label: 'Trader', bg: '#D1FAE5', color: '#065F46' },
      finance_partner: { label: 'Partner', bg: '#EDE9FE', color: '#5B21B6' },
      ops_admin: { label: 'Admin', bg: '#F3F4FB', color: '#1F2937' }
    };
    const r = roles[role] || { label: role, bg: '#F3F4F6', color: '#374151' };
    return (
      <span style={{ 
        padding: '4px 10px', 
        borderRadius: '6px', 
        fontSize: '11px', 
        fontWeight: 700, 
        background: r.bg, 
        color: r.color,
        textTransform: 'uppercase'
      }}>
        {r.label}
      </span>
    );
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>User Directory</h2>
          <p style={{ color: '#6B7280', marginTop: '4px' }}>Manage all registered users and their system access levels.</p>
        </div>
        <Button variant="secondary" onClick={fetchUsers}>↻ Refresh</Button>
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #F3F4F6' }}>
                <th style={{ padding: '20px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Full Name</th>
                <th style={{ padding: '20px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Email / Org</th>
                <th style={{ padding: '20px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Role</th>
                <th style={{ padding: '20px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '20px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{u.full_name}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text2)' }}>{u.email}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{u.org_name}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    {getRoleBadge(u.role)}
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.is_active ? '#10B981' : '#EF4444' }}></div>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{u.is_active ? 'Active' : 'Locked'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--pu)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default UserDirectory;
