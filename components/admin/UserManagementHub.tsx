"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../ui';
import { apiClient } from '@/lib/api';
import { User, Role } from '@/lib/types';
import UserInvite from './UserInvite';
import VerificationInBox from './VerificationInBox';

interface UserManagementHubProps {
  onNotify: (msg: string, type?: string) => void;
}

type Tab = 'ALL' | 'STAFF' | 'TRADERS' | 'FINANCE PARTNERS';

type HubMode = 'LIST' | 'PROVISION' | 'VERIFY';

const UserManagementHub: React.FC<UserManagementHubProps> = ({ onNotify }) => {
  const [activeTab, setActiveTab] = useState<Tab>('ALL');
  const [mode, setMode] = useState<HubMode>('LIST');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getUsers();
      setUsers(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      onNotify('Failed to synchronize user directory. Please check your session.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (activeTab === 'STAFF') return ['ceo', 'cfo', 'deal_officer', 'ops_admin'].includes(u.role);
    if (activeTab === 'TRADERS') return u.role === 'trader';
    if (activeTab === 'FINANCE PARTNERS') return u.role === 'finance_partner';
    return true;
  });

  const getRoleBadge = (role: string) => {
    const roles: any = {
      ceo: { label: 'CEO', bg: 'var(--cr-bg)', color: 'var(--cr)' },
      cfo: { label: 'CFO', bg: 'var(--cr-bg)', color: 'var(--cr-l)' },
      deal_officer: { label: 'Officer', bg: '#f1f5f9', color: 'var(--nv)' },
      trader: { label: 'Trader', bg: '#fef3c7', color: '#92400e' }, // Keeping gold/amber for traders
      finance_partner: { label: 'Finance Partner', bg: 'var(--pu-bg)', color: 'var(--pu)' },
      ops_admin: { label: 'Admin', bg: '#f3f4fb', color: 'var(--nv-m)' }
    };
    const r = roles[role] || { label: role, bg: '#F3F4F6', color: '#374151' };
    return (
      <span style={{ 
        padding: '5px 10px', 
        borderRadius: '6px', 
        fontSize: '10px', 
        fontWeight: 800, 
        background: r.bg, 
        color: r.color, 
        textTransform: 'uppercase',
        border: `1px solid ${role === 'trader' ? '#fde68a' : (role === 'finance_partner' ? 'var(--pu-b)' : (role === 'ceo' || role === 'cfo' ? 'var(--cr-b)' : 'transparent'))}`
      }}>
        {r.label}
      </span>
    );
  };

  return (
    <div className="fade-in">
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827' }}>
            {mode === 'LIST' ? 'User Management' : mode === 'PROVISION' ? 'Add New User' : 'Verification Inbox'}
          </h2>
          <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>
            {mode === 'LIST' ? 'Manage staff access, verify traders, and add new users.' : 
             mode === 'PROVISION' ? 'Create new organizational roles and provision system access.' : 
             'Review and approve business credentials for new trader organizations.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {mode === 'LIST' ? (
                <>
                    <Button variant="secondary" onClick={fetchUsers}>↻ Refresh</Button>
                    <Button onClick={() => setMode('PROVISION')}>+ Add New User</Button>
                </>
            ) : (
                <Button variant="secondary" onClick={() => setMode('LIST')}>← Back to Hub</Button>
            )}
        </div>
      </div>

      {mode === 'LIST' && (
        <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #E5E7EB', marginBottom: '24px', overflowX: 'auto', paddingBottom: '2px' }}>
                {(['ALL', 'STAFF', 'TRADERS', 'FINANCE PARTNERS'] as Tab[]).map(t => (
                <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{
                    padding: '12px 4px',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: activeTab === t ? 'var(--cr)' : '#6B7280',
                    borderBottom: activeTab === t ? '2px solid var(--cr)' : '2px solid transparent',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                    }}
                >
                    {t}
                </button>
                ))}
            </div>

            {/* Content Area */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div className="tbl-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>User / Organization</th>
                        <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>User Type</th>
                        <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Status</th>
                        {activeTab === 'TRADERS' && (
                            <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Trades</th>
                        )}
                        <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Joined</th>
                        <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                <tbody>
                    {loading ? (
                    <tr><td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>Synchronizing directory...</td></tr>
                    ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>No users found in this category.</td></tr>
                    ) : filteredUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }} className="row-hover">
                        <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', 
                            background: u.role === 'trader' ? 'var(--cr-bg)' : '#F3F4F6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: u.role === 'trader' ? 'var(--cr)' : '#6B7280',
                            fontSize: '12px'
                            }}>
                            {u.full_name.charAt(0)}
                            </div>
                            <div>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: '14px' }}>{u.full_name}</div>
                            <div style={{ fontSize: '11px', color: '#6B7280' }}>{u.email} · <span style={{ fontWeight: 600 }}>{u.org_name}</span></div>
                            </div>
                        </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>{getRoleBadge(u.role)}</td>
                        <td style={{ padding: '16px 24px' }}>
                            {u.role === 'trader' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ 
                                        width: '6px', height: '6px', borderRadius: '50%', 
                                        background: u.kyc_status === 'VERIFIED' ? '#10B981' : (u.kyc_status === 'PENDING' ? '#F59E0B' : '#9CA3AF') 
                                    }}></div>
                                    <span style={{ 
                                        fontSize: '11px', fontWeight: 700, 
                                        color: u.kyc_status === 'VERIFIED' ? '#065F46' : (u.kyc_status === 'PENDING' ? '#92400E' : '#4B5563')
                                    }}>
                                        {u.kyc_status || 'NOT SUBMITTED'}
                                    </span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.is_active ? '#10B981' : '#EF4444' }}></div>
                                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{u.is_active ? 'Active' : 'Locked'}</span>
                                </div>
                            )}
                        </td>
                        {activeTab === 'TRADERS' && (
                        <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{u.trade_count || 0} Deals</div>
                        </td>
                        )}
                        <td style={{ padding: '16px 24px', fontSize: '12px', color: '#6B7280' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        {u.kyc_status === 'PENDING' ? (
                            <Button variant="primary" size="sm" onClick={() => { setSelectedUser(u); setMode('VERIFY'); }}>
                            REVIEW KYC
                            </Button>
                        ) : (
                            <Button variant="ghost" size="sm" style={{ fontWeight: 700, color: 'var(--cr)' }}>
                            MANAGE
                            </Button>
                        )}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
              </div>
            </Card>
        </>
      )}

      {/* Provision Sub-page */}
      {mode === 'PROVISION' && (
        <div className="fade-in">
             <Card style={{ padding: '32px' }}>
                <UserInvite onNotify={onNotify} onSuccess={() => { setMode('LIST'); fetchUsers(); }} />
             </Card>
        </div>
      )}

      {/* Verification Sub-page */}
      {mode === 'VERIFY' && (
        <div className="fade-in">
            <div style={{ maxWidth: '100% border-box' }}>
                <VerificationInBox onNotify={onNotify} targetTraderId={selectedUser?.id} />
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

export default UserManagementHub;
