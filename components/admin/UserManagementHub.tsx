"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import { apiClient } from '@/lib/api';
import UserInvite from './UserInvite';
import { UserRowActionsMenu } from './UserRowActionsMenu';

interface UserManagementHubProps {
  onNotify: (msg: string, type?: string) => void;
  onBack?: () => void;
  onOpenVerificationInbox?: (traderOrgId?: string) => void;
  onEditUserProfile: (userId: string) => void;
  currentUserId?: string;
}

type Tab = 'ALL' | 'STAFF' | 'TRADERS' | 'FINANCE PARTNERS';
type HubMode = 'LIST' | 'PROVISION';

const UserManagementHub: React.FC<UserManagementHubProps> = ({
  onNotify,
  onBack,
  onOpenVerificationInbox,
  onEditUserProfile,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('ALL');
  const [mode, setMode] = useState<HubMode>('LIST');
  const [users, setUsers] = useState<any[]>([]);
  const [dataSource, setDataSource] = useState<string>('database');
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getUsers();
      setUsers(response.data || []);
      setDataSource(response.meta?.source || 'database');
    } catch (err: any) {
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
      cfo: { label: 'Finance Officer', bg: 'var(--cr-bg)', color: 'var(--cr-l)' },
      deal_officer: { label: 'Officer', bg: '#f1f5f9', color: 'var(--nv)' },
      trader: { label: 'Trader', bg: '#fef3c7', color: '#92400e' },
      finance_partner: { label: 'Finance Partner', bg: 'var(--pu-bg)', color: 'var(--pu)' },
      ops_admin: { label: 'Admin', bg: '#f3f4fb', color: 'var(--nv-m)' },
    };
    const r = roles[role] || { label: role, bg: '#F3F4F6', color: '#374151' };
    return (
      <span style={{
        padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
        background: r.bg, color: r.color, textTransform: 'uppercase', letterSpacing: '0.02em',
        border: `1px solid ${role === 'trader' ? '#fde68a' : (role === 'finance_partner' ? 'var(--pu-b)' : (role === 'ceo' || role === 'cfo' ? 'var(--cr-b)' : 'transparent'))}`,
      }}>
        {r.label}
      </span>
    );
  };

  const handleUnlockUser = async (user: any) => {
    setActionBusy(true);
    try {
      await apiClient.unlockUser({ user_id: user.id });
      onNotify(`${user.email} unlocked.`, 'success');
      fetchUsers();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to unlock user.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetMfa = async (user: any) => {
    if (!window.confirm(`Reset MFA for ${user.email}? They will be asked to re-enroll on next login.`)) return;
    setActionBusy(true);
    try {
      await apiClient.resetUserMfa({ user_id: user.id });
      onNotify(`MFA reset for ${user.email}. They must re-enroll on next login.`, 'success');
      fetchUsers();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to reset MFA.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (user.id === currentUserId) {
      onNotify('You cannot delete your own account.', 'error');
      return;
    }
    const ok = window.confirm(
      `Permanently delete ${user.email}? This removes the account from the user directory and cannot be undone.`
    );
    if (!ok) return;
    setActionBusy(true);
    try {
      const res = await apiClient.deleteAdminUser(user.id);
      onNotify(res.message || 'User deleted.', 'success');
      fetchUsers();
    } catch (err: any) {
      onNotify(err?.message || 'Failed to delete user.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const isLocked = (u: any) => u.locked_until && new Date(u.locked_until) > new Date();

  const isTraderOrFinancePartner = (role: string) => role === 'trader' || role === 'finance_partner';

  /** Table summary: partners show institution + email; staff show person + email */
  const userOrgColumn = (u: any) => {
    const partner = isTraderOrFinancePartner(u.role);
    const primary = partner ? (u.org_name?.trim() || u.full_name || '—') : (u.full_name || '—');
    const initialSource = partner ? (u.org_name?.trim() || u.full_name || u.email) : (u.full_name || u.email);
    const initial = (initialSource && String(initialSource).charAt(0).toUpperCase()) || '?';
    const avatarBg = !partner ? '#F3F4F6' : u.role === 'finance_partner' ? 'var(--pu-bg)' : 'var(--cr-bg)';
    const avatarColor = !partner ? '#475569' : u.role === 'finance_partner' ? 'var(--pu)' : 'var(--cr)';
    return { partner, primary, initial, avatarBg, avatarColor };
  };

  return (
    <div className="fade-in">
      {/* Navigation */}
      <div style={{ marginBottom: '32px' }}>
        <div
          onClick={() => { if (mode !== 'LIST') setMode('LIST'); else if (onBack) onBack(); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--cr)', fontSize: '13px', fontWeight: 800, marginBottom: '16px', transition: 'transform 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(-4px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          BACK TO {mode === 'LIST' ? 'PREVIOUS PAGE' : 'USER DIRECTORY'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.04em', color: '#111827', margin: 0 }}>
              {mode === 'LIST' ? 'User Management' : 'Add New User'}
            </h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>
              {mode === 'LIST' ? 'Manage staff access, verify traders, and add new users.' :
                'Create accounts. Users set their own password and 2FA on first login.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {mode === 'LIST' && (
              <>
                <span style={{ fontSize: '12px', color: '#64748B', alignSelf: 'center' }}>
                  Source: <strong style={{ color: '#111827' }}>{dataSource === 'database' ? 'Live Database' : dataSource}</strong>
                </span>
                <Button variant="secondary" onClick={fetchUsers}>↻ Refresh</Button>
                <Button onClick={() => setMode('PROVISION')}>+ Add User</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {mode === 'LIST' && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #E5E7EB', marginBottom: '24px', overflowX: 'auto', paddingBottom: '2px' }}>
            {(['ALL', 'STAFF', 'TRADERS', 'FINANCE PARTNERS'] as Tab[]).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: '12px 4px', fontSize: '13px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === t ? 'var(--cr)' : '#6B7280',
                borderBottom: activeTab === t ? '2px solid var(--cr)' : '2px solid transparent',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}>
                {t}
              </button>
            ))}
          </div>

          <Card style={{ padding: 0, overflow: 'visible' }}>
            <div className="tbl-wrap user-mgmt-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>User / Organization</th>
                    <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role</th>
                    <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                    <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Security</th>
                    {activeTab === 'TRADERS' && (
                      <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trades</th>
                    )}
                    <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Added</th>
                    <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>Synchronizing directory...</td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>No users found in this category.</td></tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }} className="row-hover">
                      <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                        {(() => {
                          const { primary, initial, avatarBg, avatarColor } = userOrgColumn(u);
                          return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '8px',
                            background: avatarBg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: avatarColor, fontSize: '14px',
                          }}>
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: '15px', lineHeight: 1.35 }}>{primary}</div>
                            <div style={{ fontSize: '13px', color: '#374151', marginTop: '4px', lineHeight: 1.45 }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>{getRoleBadge(u.role)}</td>
                      <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                        {u.role === 'trader' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: u.kyc_status === 'VERIFIED' ? '#10B981' : (u.kyc_status === 'PENDING' ? '#F59E0B' : '#9CA3AF') }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: u.kyc_status === 'VERIFIED' ? '#065F46' : (u.kyc_status === 'PENDING' ? '#92400E' : '#374151') }}>
                              {u.kyc_status || 'NOT SUBMITTED'}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: isLocked(u) ? '#F59E0B' : (u.is_active ? '#10B981' : '#EF4444') }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                              {isLocked(u) ? 'Temp. Locked' : u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        )}
                      </td>
                      {/* Security column — read-only indicator, no admin setup */}
                      <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: u.must_change_password ? '#B45309' : '#047857' }}>
                            {u.must_change_password ? '⚠ Awaiting pw reset' : '✓ Password set'}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: u.totp_enabled ? '#047857' : '#475569' }}>
                            {u.totp_enabled ? '✓ 2FA active' : '○ 2FA not yet enrolled'}
                          </span>
                        </div>
                      </td>
                      {activeTab === 'TRADERS' && (
                        <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>{u.trade_count || 0} Deals</div>
                        </td>
                      )}
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 500, color: '#374151', verticalAlign: 'middle' }}>
                        {u.admin_added_at ? new Date(u.admin_added_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {(u.kyc_status === 'PENDING' || u.kyc_status === 'UNDER_REVIEW') && u.org_id && u.role === 'trader' ? (
                            <Button variant="primary" size="sm" onClick={() => onOpenVerificationInbox?.(u.org_id)}>
                              REVIEW KYC
                            </Button>
                          ) : u.kyc_status === 'REJECTED' && u.org_id && u.role === 'trader' ? (
                            <Button variant="secondary" size="sm" onClick={() => onOpenVerificationInbox?.(u.org_id)}>
                              VIEW KYC
                            </Button>
                          ) : null}
                          {isLocked(u) && (
                            <Button variant="ghost" size="sm" style={{ fontWeight: 700, color: '#B45309', fontSize: '13px' }} onClick={() => handleUnlockUser(u)} disabled={actionBusy}>
                              UNLOCK
                            </Button>
                          )}
                          {u.totp_enabled && (
                            <Button variant="ghost" size="sm" style={{ fontWeight: 700, color: '#374151', fontSize: '13px' }} onClick={() => handleResetMfa(u)} disabled={actionBusy}>
                              RESET MFA
                            </Button>
                          )}
                          <UserRowActionsMenu
                            isOpen={openMenuUserId === u.id}
                            onOpen={() => setOpenMenuUserId(u.id)}
                            onClose={() => setOpenMenuUserId(null)}
                            onEditProfile={() => onEditUserProfile(u.id)}
                            onDeleteUser={() => handleDeleteUser(u)}
                            deleteDisabled={actionBusy || u.id === currentUserId}
                            deleteLabel="Delete user"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {mode === 'PROVISION' && (
        <div className="fade-in">
          <Card style={{ padding: '32px' }}>
            <UserInvite onNotify={onNotify} onSuccess={() => { setMode('LIST'); fetchUsers(); }} />
          </Card>
        </div>
      )}

      <style jsx>{`
        .row-hover:hover { background: #F9FAFB !important; }
        .user-mgmt-table-wrap :global(.btn-sm) {
          font-size: 13px !important;
          padding: 8px 14px !important;
          min-height: 36px;
        }
      `}</style>
    </div>
  );
};

export default UserManagementHub;
