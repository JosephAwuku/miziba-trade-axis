"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Role, View, Trade } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import BottomNav from '@/components/BottomNav';
import Login, { LoginResult } from '@/components/Login';
import SecuritySetup from '@/components/SecuritySetup';
import { Button, Card } from '@/components/ui';
import { usd } from '@/lib/utils';
import { commodityLabel } from '@/lib/data';
import { sumFacilityByDeployment } from '@/lib/portfolio-metrics';
import DealDetail from '@/components/views/DealDetail';
import Portfolio from '@/components/views/Portfolio';
import Settlement from '@/components/views/Settlement';
import BuyerIntelligence from '@/components/views/BuyerIntelligence';
import AggregatorIntelligence from '@/components/views/AggregatorIntelligence';
import TraderPortal from '@/components/views/TraderPortal';
import FinancePartnerPortal from '@/components/views/FinancePartnerPortal';
import FinancePartnerCRM from '@/components/views/FinancePartnerCRM';
import UserManagementHub from '@/components/admin/UserManagementHub';
import AdminUserEditPage from '@/components/admin/AdminUserEditPage';
import AdminBuyerEditPage from '@/components/admin/AdminBuyerEditPage';
import AdminAggregatorEditPage from '@/components/admin/AdminAggregatorEditPage';
import VerificationInBox from '@/components/admin/VerificationInBox';
import AuditLogViewer from '@/components/admin/AuditLogViewer';
import NotificationsInbox from '@/components/admin/NotificationsInbox';
import TradeOperations from '@/components/views/TradeOperations';
import RiskAssessmentTool from '@/components/RiskAssessmentTool';
import { useNavigation } from '@/lib/contexts/NavigationContext';
import { ConfirmDialog } from '@/components/ui';
import { SessionTimer } from '@/components/SessionTimer';
import { UsersManagementIcon } from '@/components/icons/UsersManagementIcon';
import { AuditLogIcon } from '@/components/icons/AuditLogIcon';
import { RequiredActionIcon } from '@/components/icons/RequiredActionIcon';
import { TradeApplicationIcon } from '@/components/icons/TradeApplicationIcon';
import { BuyerDatabaseIcon } from '@/components/icons/BuyerDatabaseIcon';

const PlaceholderView = ({ title, icon }: { title: string; icon?: string }) => (
  // ... (rest of PlaceholderView)
  <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
    <div style={{ fontSize: '48px', marginBottom: '20px' }}>{icon || '🚧'}</div>
    <h2 style={{ fontSize: '20px', color: 'var(--text3)', fontWeight: 700 }}>{title}</h2>
    <p style={{ marginTop: '10px', color: '#6B7280' }}>This module is scheduled for the next development sprint.</p>
  </div>
);

export default function Home() {
  // ... (rest of the state and handlers)
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);
  const [view, setView] = useState<View>('pipeline');
  const [deal, setDeal] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewHistory, setViewHistory] = useState<View[]>([]);
  const [selectedVerificationTraderId, setSelectedVerificationTraderId] = useState<string | undefined>(undefined);
  const [adminEditingUserId, setAdminEditingUserId] = useState<string | null>(null);
  const [editingBuyerId, setEditingBuyerId] = useState<string | null>(null);
  const [editingAggregatorId, setEditingAggregatorId] = useState<string | null>(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [notificationRefreshToken, setNotificationRefreshToken] = useState(0);
  const [onboardingState, setOnboardingState] = useState<LoginResult | null>(null);
  const [adminDashboard, setAdminDashboard] = useState<{
    pending_verifications: number;
    total_users: number;
    active_users: number;
    failed_webhooks: number;
    activities: Array<{ id: string; title: string; subtitle: string; timestamp: string }>;
  } | null>(null);
  const [adminDashboardLoading, setAdminDashboardLoading] = useState(false);
  const [adminDashboardError, setAdminDashboardError] = useState<string | null>(null);

  const notify = (msg: string, type: string = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const getDefaultViewForRole = useCallback((activeRole: Role): View => {
    if (activeRole === 'trader') return 'trs_overview';
    if (activeRole === 'cfo') return 'cfo_overview';
    if (activeRole === 'finance_partner') return 'fp_overview';
    if (activeRole === 'ceo') return 'ceo_overview';
    if (activeRole === 'ops_admin') return 'ops_overview';
    return 'pipeline';
  }, []);

  const persistSessionView = useCallback((nextView: View) => {
    const savedSession = localStorage.getItem('tradeaxis_session');
    if (savedSession) {
      const session = JSON.parse(savedSession);
      localStorage.setItem('tradeaxis_session', JSON.stringify({ ...session, view: nextView }));
    }
  }, []);

  const navigateToView = useCallback((nextView: View, options?: { trackHistory?: boolean }) => {
    const shouldTrackHistory = options?.trackHistory !== false;
    if (shouldTrackHistory && view !== nextView) {
      setViewHistory(prev => [...prev, view].slice(-20));
    }
    setView(nextView);
    setDeal(null);
    persistSessionView(nextView);
  }, [persistSessionView, view]);

  const openNotifications = useCallback((notificationId?: string) => {
    setSelectedNotificationId(notificationId ?? null);
    navigateToView('admin_notifications');
  }, [navigateToView]);

  const handleNotificationsChange = useCallback(() => {
    setNotificationRefreshToken(prev => prev + 1);
  }, []);

  const navigateBack = useCallback(() => {
    if (deal) {
      setDeal(null);
      return;
    }

    setViewHistory(prev => {
      const historyCopy = [...prev];
      const previousView = historyCopy.pop();
      const fallbackView = getDefaultViewForRole(role);
      const targetView = previousView || fallbackView;
      setView(targetView);
      setDeal(null);
      persistSessionView(targetView);
      return historyCopy;
    });
  }, [deal, getDefaultViewForRole, persistSessionView, role]);

  useEffect(() => {
    if (role) {
      fetchTrades();

      // Real-time subscription
      if (supabase) {
        const channel = supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'trades',
            },
            () => {
              console.log('Real-time update received, refetching trades...');
              fetchTrades();
            }
          )
          .subscribe();

        return () => {
          if (supabase) {
            supabase.removeChannel(channel);
          }
        };
      }
    }
  }, [role, view, searchTerm]);

  const fetchTrades = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiClient.isAuthenticated()) {
        setLoading(false);
        return;
      }
      // In production, session is already set by Supabase Auth
      const response = await apiClient.getTrades({ search: searchTerm });

      // Map TradeSummary[] (DB types) to Trade[] (UI types)
      const mappedTrades: Trade[] = response.data.map(t => ({
        id: t.id,
        tr: t.trader_name,
        tid: t.trade_ref,
        cmd: t.commodity as any,
        vol: t.volume_mt,
        gr: t.grade as any,
        buyer: t.buyer_name,
        bc: 'GH', // Placeholder
        price: t.price_per_mt_usd,
        cv: t.contract_value_usd,
        pc: t.contract_value_usd * 0.8, // Approximation
        eq: t.contract_value_usd * 0.35,
        ff: t.finance_facility_usd,
        dp: 'Tema Port',
        dl: t.deadline_date,
        pt: 30,
        stage: t.stage as any,
        traderOrgKyc: (t.trader_org_kyc_status || t.kyc_status || 'PENDING') as Trade['traderOrgKyc'],
        kyc: (t.trader_org_kyc_status || t.kyc_status || 'PENDING') as Trade['kyc'],
        risk: t.risk_score,
        off: 'Internal',
        dt: t.applied_at,
        escrow: null,
        ship: null,
        bpay: null,
        dep: t.capital_deployed_pct,
        val: { b: true, p: true, s: true, k: true, r: true },
        rb: null,
        fp: null,
      }));

      setTrades(mappedTrades);
    } catch (err: any) {
      console.error('Failed to fetch trades:', err);
      // If we get an auth error, the session might be stale or malformed
      if (err.message?.includes('401') || err.message?.toLowerCase().includes('unauthorized')) {
        handleLogout();
      } else {
        setError(err.message || 'Failed to load trades. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Restore session from localStorage on mount
    const savedSession = localStorage.getItem('tradeaxis_session');
    if (savedSession) {
      try {
        const { user: u, role: r, token, view: v } = JSON.parse(savedSession);
        if (u && r) {
          setUser(u);
          setRole(r);
          if (token) {
            apiClient.setToken(token);
          }
          if (v) {
            setView(v);
          } else {
            // Set default view based on role if missing from session
            if (r === 'trader') setView('trs_overview');
            else if (r === 'cfo') setView('cfo_overview');
            else if (r === 'finance_partner') setView('fp_overview');
            else if (r === 'ceo') setView('ceo_overview');
            else if (r === 'ops_admin') setView('ops_overview');
            else setView('pipeline');
          }
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
        localStorage.removeItem('tradeaxis_session');
      }
    }
    // Small delay to ensure smooth transition
    setTimeout(() => setIsCheckingSession(false), 300);
  }, []);

  const handleLoginSuccess = (user: any, role: Role, token?: string, expiresAt?: string) => {
    setUser(user);
    setRole(role);

    if (token) {
      apiClient.setToken(token);
    }

    // Set appropriate initial view
    const initialView: View = getDefaultViewForRole(role);

    setView(initialView);

    // Persist session with initial view and expiry
    const sessionData: any = { user, role, token, view: initialView };
    if (expiresAt) {
      sessionData.expires_at = expiresAt;
    }
    localStorage.setItem('tradeaxis_session', JSON.stringify(sessionData));

    setDeal(null);
  };

  const handleLogout = () => {
    setRole(null);
    setUser(null);
    setViewHistory([]);
    setOnboardingState(null);
    setSelectedVerificationTraderId(undefined);
    setAdminEditingUserId(null);
    apiClient.setToken('');
    localStorage.removeItem('tradeaxis_session');
  };

  // Keep the API client aware of the logout handler so it can trigger it
  // automatically when a token refresh fails or any request returns 401.
  useEffect(() => {
    apiClient.setOnSessionExpired(handleLogout);
  });

  const handleExtendSession = async () => {
    try {
      // Force a token refresh which will update the expiry
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiClient['token']}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token && data.expires_at) {
          apiClient.setToken(data.token);
          const session = localStorage.getItem('tradeaxis_session');
          if (session) {
            const parsed = JSON.parse(session);
            localStorage.setItem('tradeaxis_session', JSON.stringify({
              ...parsed,
              token: data.token,
              expires_at: data.expires_at,
            }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to extend session:', err);
    }
  };

  const handleOnboarding = (result: LoginResult) => {
    setOnboardingState(result);
  };

  const handleOnboardingComplete = (sessionToken: string, user: any, expiresAt?: string) => {
    apiClient.setToken(sessionToken);
    setOnboardingState(null);
    handleLoginSuccess(user, user.role, sessionToken, expiresAt);
  };

  const { requestNavigation, showConfirm, confirmNavigation, cancelNavigation } = useNavigation();

  const handleViewChange = (v: View) => {
    requestNavigation(v, (nextView) => {
      const resolvedView = nextView === 'trs_verify' ? 'trs_company' : nextView;
      if (resolvedView === 'admin_verify') {
        setSelectedVerificationTraderId(undefined);
      }
      if (resolvedView !== 'admin_user_edit') {
        setAdminEditingUserId(null);
      }
      if (resolvedView !== 'buyer_edit') {
        setEditingBuyerId(null);
      }
      navigateToView(resolvedView as View);
    });
  };

  const handleBackNavigation = () => {
    requestNavigation('__back__', () => {
      navigateBack();
    });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, deal, tab]);

  const fetchAdminDashboard = useCallback(async () => {
    if (role !== 'ops_admin' || view !== 'ops_overview') {
      setAdminDashboardLoading(false);
      setAdminDashboardError(null);
      return;
    }

    setAdminDashboardLoading(true);
    setAdminDashboardError(null);

    try {
      const res = await apiClient.getAdminDashboard();
      setAdminDashboard(res);
    } catch (err: any) {
      console.error('Failed to fetch admin dashboard:', err);
      setAdminDashboard(null);
      setAdminDashboardError(err?.message || 'Failed to load admin dashboard data.');
    } finally {
      setAdminDashboardLoading(false);
    }
  }, [role, view]);

  useEffect(() => {
    fetchAdminDashboard();
  }, [fetchAdminDashboard]);

  if (isCheckingSession) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1f3c',
        color: '#fff'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #8B0000, #C41E3A)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: 800,
          marginBottom: '20px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
        }}>T</div>
        <div style={{ fontSize: '11px', letterSpacing: '0.2em', opacity: 0.5 }}>SYNCHRONIZING SECURE SESSION...</div>
      </div>
    );
  }

  if (!role) {
    if (onboardingState && onboardingState.next_step !== 'DONE') {
      return (
        <SecuritySetup
          step={onboardingState.next_step as any}
          user={onboardingState.user}
          onboardingToken={(onboardingState as any).onboarding_token || ''}
          onComplete={handleOnboardingComplete}
        />
      );
    }
    return <Login onLoginSuccess={handleLoginSuccess} onOnboarding={handleOnboarding} />;
  }

  const roleLabel = { deal_officer: 'Deal Officer', ceo: 'Head of Trade / CEO', cfo: 'Finance Officer', trader: 'Trader', finance_partner: 'Finance Partner', ops_admin: 'Operations Admin' }[role as string] || role;
  const dashboardTitle = {
    ops_admin: 'Admin Dashboard',
    ceo: 'CEO Dashboard',
    cfo: 'Finance Officer Dashboard',
    deal_officer: 'Deal Officer Dashboard',
    trader: 'Trader Dashboard',
    finance_partner: 'Finance Partner Dashboard',
  }[role as string] || 'Dashboard';

  // Logic for Traders/FP portals would go here in original, 
  // for now focusing on Internal Shell

  const viewLabels: Record<string, string> = {
    pipeline: 'Trade Operations',
    portfolio: 'Portfolio',
    risk_calc: 'Risk Calculator',
    buyers: 'Buyer Database',
    aggregators: 'Aggregator Database',
    fp_crm: 'Finance Partners',
    settle: 'Settlement',
    trs_status: 'Trade Applications',
    trs_apply: 'New Trade Application',
    trs_drafts: 'Draft Applications',
    trs_settle: 'Payments',
    trs_company: 'Company Profile',
    trs_overview: 'Dashboard Overview',
    fp_overview: 'Finance Partner Overview',
    fp_inbox: 'Pending Requests',
    fp_portfolio: 'Finance Partner Portfolio',
    fp_reports: 'Settlement Reports',
    fp_onboarding: 'Onboarding',
    ceo_overview: 'Strategic Overview',
    cfo_overview: 'Finance Officer Overview',
    ops_overview: 'System Overview',
    admin_onboard: 'User Management',
    admin_user_edit: 'Edit user profile',
    buyer_edit: 'Buyer profile',
    aggregator_edit: 'Aggregator profile',
    admin_directory: 'User Directory',
    admin_verify: 'Required Action',
    admin_notifications: 'Notifications',
    admin_audit: 'Audit Log'
  };

  const currentViewLabel = dashboardTitle;

  return (
    <div className="app">
      {notification && (
        <div id="notif" className="show" style={{
          background:
            notification.type === 'error'
              ? 'var(--da-bg)'
              : notification.type === 'warning'
                ? 'var(--wa-bg)'
                : 'var(--su-bg)',
          color:
            notification.type === 'error'
              ? 'var(--da)'
              : notification.type === 'warning'
                ? 'var(--wa)'
                : 'var(--su)',
          border: `1px solid ${
            notification.type === 'error'
              ? 'var(--da-b)'
              : notification.type === 'warning'
                ? 'var(--wa-b)'
                : 'var(--su-b)'
          }`,
        }}>
          {notification.type === 'error' || notification.type === 'warning' ? '⚠' : '✓'}{' '}
          {notification.msg}
        </div>
      )}

      <Sidebar
        role={role}
        view={view}
        deal={deal}
        user={user}
        onViewChange={handleViewChange}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="main">
        <Topbar
          viewLabel={currentViewLabel}
          roleLabel={roleLabel}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onLogout={handleLogout}
          onNotify={notify}
          onViewAllNotifications={() => openNotifications()}
          onOpenNotification={(notificationId) => openNotifications(notificationId)}
          notificationRefreshToken={notificationRefreshToken}
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
        />

        <div className="content fade-in">
          {(deal || (role === 'trader' && view !== 'trs_overview' && view !== 'trs_status' && view !== 'trs_drafts' && view !== 'admin_notifications') || ((role !== 'trader' && role !== 'finance_partner') && !['pipeline', 'portfolio', 'fp_crm', 'risk_calc', 'ceo_overview', 'cfo_overview', 'ops_overview', 'admin_onboard', 'admin_user_edit', 'buyer_edit', 'aggregators', 'aggregator_edit', 'admin_verify', 'admin_notifications', 'admin_audit'].includes(view))) && (
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={handleBackNavigation}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--cr)',
                  fontSize: '13px',
                  fontWeight: 800,
                  padding: '4px 0',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  letterSpacing: '0.02em'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                BACK TO {deal ? (viewLabels[view]?.toUpperCase() || 'LIST') : 'DASHBOARD'}
              </button>
            </div>
          )}
          {(role === 'deal_officer' || role === 'ceo' || role === 'cfo' || role === 'ops_admin') && (
            <>
              {view === 'ceo_overview' && !deal && (
                <div className="fade-in">
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Strategic Command Center</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text2)' }}>High-level portfolio performance, capital tracking, and risk breakdown.</p>
                  </div>

                  <div className="g3" style={{ marginBottom: '32px' }}>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>TOTAL DEPLOYED CAPITAL</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{usd(trades.filter(t => ['FUNDED', 'PROCURING', 'DELIVERED'].includes(t.stage)).reduce((a, t) => a + t.ff, 0))}</div>
                      <div style={{ fontSize: '12px', color: '#8B0000', marginTop: '6px', fontWeight: 600 }}>Zero defaults reported</div>
                    </Card>
                    <Card
                      style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                      onClick={() => navigateToView('pipeline')}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>ELEVATED RISK TRANSACTIONS</span>
                        <span style={{ color: 'var(--cr)' }}>VIEW →</span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--cr)' }}>{trades.filter(t => (t.risk || 0) < 55).length}</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Requires CEO override to proceed</p>
                    </Card>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>UPCOMING SETTLEMENTS</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{trades.filter(t => t.stage === 'DELIVERED').length}</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Facilities ready for CFO resolution</p>
                    </Card>
                  </div>

                  <div className="g2-responsive" style={{ marginBottom: '24px' }}>
                    <Card>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Action Required</h3>
                        <Button variant="secondary" size="sm" onClick={() => navigateToView('pipeline')}>View Pipeline</Button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {trades.filter(t => t.stage === 'UNDER_VALIDATION' || (t.risk && t.risk < 55 && t.stage === 'VALIDATED')).length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
                            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                            </div>
                            <p style={{ fontSize: '13px' }}>No strategic escalations pending review.</p>
                          </div>
                        ) : (
                          trades.filter(t => t.stage === 'UNDER_VALIDATION' || (t.risk && t.risk < 55 && t.stage === 'VALIDATED')).slice(0, 4).map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{t.tr} · {commodityLabel(t.cmd)}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{usd(t.cv)} · {t.risk && t.risk < 55 ? 'Elevated Risk Escalation' : 'Final Validation'}</div>
                              </div>
                              <Button variant="primary" size="sm" onClick={() => { navigateToView('pipeline'); setDeal(t.id); }}>Review Deal</Button>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Strategic Hub</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => navigateToView('fp_crm')}>
                          <span style={{ marginRight: '10px' }}>◆</span> Finance Partners
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => navigateToView('risk_calc')}>
                          <span style={{ marginRight: '10px' }}>⬡</span> Risk Assessment Tool
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => navigateToView('buyers')}>
                          <span style={{ display: 'inline-flex', flexShrink: 0, color: 'inherit' }} aria-hidden>
                            <BuyerDatabaseIcon size={18} />
                          </span>
                          Buyer Database
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => navigateToView('admin_onboard')}>
                          <span style={{ marginRight: '10px', display: 'inline-flex', alignItems: 'center', color: 'inherit' }}><UsersManagementIcon size={18} /></span> User Management
                        </Button>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {view === 'ops_overview' && !deal && (
                <div className="fade-in">
                    <div style={{ marginBottom: '24px' }}>
                      <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>System Overview</h2>
                      <p style={{ fontSize: '14px', color: 'var(--text2)', marginTop: '8px' }}>Operational monitoring, user verification queues, and read-only visibility into all trades.</p>
                    </div>
                  {adminDashboardError && (
                    <Card style={{ marginBottom: '20px', borderColor: '#FECACA', background: '#FEF2F2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#991B1B', marginBottom: '4px' }}>Unable to load live admin metrics</div>
                          <div style={{ fontSize: '12px', color: '#7F1D1D' }}>{adminDashboardError}</div>
                        </div>
                        <Button variant="secondary" size="sm" onClick={fetchAdminDashboard}>Retry</Button>
                      </div>
                    </Card>
                  )}

                  <div className="g3" style={{ marginBottom: '32px' }}>
                    <Card
                      style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                      onClick={() => {
                        setSelectedVerificationTraderId(undefined);
                        navigateToView('admin_verify');
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>PENDING VERIFICATIONS</span>
                        <span style={{ color: 'var(--cr)' }}>VIEW →</span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
                        {adminDashboard ? adminDashboard.pending_verifications : '—'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8B0000', marginTop: '6px', fontWeight: 600 }}>Requires manual review</div>
                    </Card>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>ACTIVE USERS</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
                        {adminDashboard ? `${adminDashboard.active_users}/${adminDashboard.total_users}` : '—'}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Live user account status from database</p>
                    </Card>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>FAILED WEBHOOKS</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
                        {adminDashboard ? adminDashboard.failed_webhooks : '—'}
                      </div>
                      <p style={{ fontSize: '12px', color: '#D97706', marginTop: '6px' }}>Pending integration retries</p>
                    </Card>
                  </div>

                  <div className="g3" style={{ marginBottom: '32px' }}>
                    <Card
                      style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                      onClick={() => navigateToView('pipeline')}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>ACTIVE TRADES</span>
                        <span style={{ color: 'var(--cr)' }}>VIEW →</span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
                        {trades.filter(t => !['CLOSED', 'DRAFT'].includes(t.stage)).length}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>{trades.length} total in system</p>
                    </Card>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>DEPLOYED CAPITAL</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
                        {usd(trades.filter(t => ['FUNDED', 'PROCURING', 'DELIVERED'].includes(t.stage)).reduce((a, t) => a + t.ff, 0))}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Across funded facilities</p>
                    </Card>
                    <Card
                      style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                      onClick={() => navigateToView('pipeline')}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>IN VALIDATION / REVIEW</span>
                        <span style={{ color: 'var(--cr)' }}>VIEW →</span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--cr)' }}>
                        {trades.filter(t => ['SUBMITTED', 'UNDER_VALIDATION', 'VALIDATED', 'FINANCE_REVIEW'].includes(t.stage)).length}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Trades moving through workflow</p>
                    </Card>
                  </div>

                  <div className="g2-responsive" style={{ marginBottom: '24px' }}>
                    <Card>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>System Audit Log</h3>
                        <Button variant="secondary" size="sm">Export Logs</Button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {adminDashboardLoading && (
                          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>
                            Loading recent audit activity...
                          </div>
                        )}
                        {!adminDashboardLoading && adminDashboardError && (
                          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>
                            Audit activity is unavailable until dashboard data is restored.
                          </div>
                        )}
                        {!adminDashboardLoading && !adminDashboardError && (adminDashboard?.activities || []).length === 0 && (
                          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>
                            No recent audit activity found.
                          </div>
                        )}
                        {!adminDashboardLoading && !adminDashboardError && (adminDashboard?.activities || []).slice(0, 4).map((entry, idx, arr) => (
                          <div
                            key={entry.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '12px',
                              borderBottom: idx < arr.length - 1 ? '1px solid #F1F5F9' : 'none'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{entry.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{entry.subtitle}</div>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                              {new Date(entry.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Admin Controls</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Button
                          variant="secondary"
                          style={{
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                          }}
                          onClick={() => navigateToView('pipeline')}
                        >
                          <span style={{ display: 'inline-flex', flexShrink: 0, color: 'inherit' }} aria-hidden>
                            <TradeApplicationIcon size={18} />
                          </span>
                          Trade Operations
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => navigateToView('portfolio')}>
                          <span style={{ marginRight: '10px' }}>◈</span> Portfolio Overview
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => {
                          navigateToView('admin_onboard');
                        }}>
                          <span style={{ marginRight: '10px', display: 'inline-flex', alignItems: 'center', color: 'inherit' }}><UsersManagementIcon size={18} /></span> User Management
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => navigateToView('buyers')}>
                          <span style={{ display: 'inline-flex', flexShrink: 0, color: 'inherit' }} aria-hidden>
                            <BuyerDatabaseIcon size={18} />
                          </span>
                          Buyer Database
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => navigateToView('admin_verify')}>
                          <span style={{ marginRight: '10px', display: 'inline-flex', alignItems: 'center', color: 'inherit' }}><RequiredActionIcon size={18} /></span> Required Action
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => navigateToView('admin_audit')}>
                          <span style={{ marginRight: '10px', display: 'inline-flex', alignItems: 'center', color: 'inherit' }}><AuditLogIcon size={18} /></span> Audit Log
                        </Button>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
              {view === 'cfo_overview' && !deal && (
                <div className="fade-in">
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Finance Officer Overview</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text2)' }}>Miziba settlement authority, liquidity oversight, and funded-facility monitoring. Facility approval sits with Finance Partners.</p>
                  </div>

                  <div className="g5" style={{ marginBottom: '32px' }}>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>TOTAL PIPELINE VALUE</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{usd(trades.reduce((a, t) => a + t.cv, 0))}</div>
                      <div style={{ fontSize: '12px', color: '#8B0000', marginTop: '6px', fontWeight: 600 }}>↑ 12% vs last month</div>
                    </Card>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>FINANCE FACILITY (PIPELINE)</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{usd(sumFacilityByDeployment(trades, false))}</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Requested · awaiting funding</p>
                    </Card>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>CAPITAL DEPLOYED</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{usd(sumFacilityByDeployment(trades, true))}</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Across {trades.filter(t => ['FUNDED', 'PROCURING', 'DELIVERED', 'SETTLED'].includes(t.stage)).length} funded facilities</p>
                    </Card>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>AVG FACILITY TENOR</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>42 Days</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Average cycle to settlement</p>
                    </Card>
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>NET YIELD (EST.)</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--cr)' }}>1.5%</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Per cycle after partner fees</p>
                    </Card>
                  </div>

                  <div className="g2-responsive" style={{ marginBottom: '24px' }}>
                    <Card>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Pending Financial Actions</h3>
                        <Button variant="secondary" size="sm" onClick={() => navigateToView('settle')}>Manage Settlements</Button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {trades.filter(t => t.stage === 'DELIVERED').length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
                            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                            </div>
                            <p style={{ fontSize: '13px' }}>All delivered goods have been processed for settlement.</p>
                          </div>
                        ) : (
                          trades.filter(t => t.stage === 'DELIVERED').map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{t.tr} · {commodityLabel(t.cmd)}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{usd(t.cv)} worth of goods delivered</div>
                              </div>
                              <Button variant="primary" size="sm" onClick={() => navigateToView('settle')}>Calculate Waterfall</Button>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Quick Access</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => navigateToView('fp_crm')}>
                          <span style={{ marginRight: '10px' }}>◆</span> Finance Partners
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => navigateToView('risk_calc')}>
                          <span style={{ marginRight: '10px' }}>⬡</span> Risk Assessment Tool
                        </Button>
                        <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => navigateToView('buyers')}>
                          <span style={{ display: 'inline-flex', flexShrink: 0, color: 'inherit' }} aria-hidden>
                            <BuyerDatabaseIcon size={18} />
                          </span>
                          Buyer Database
                        </Button>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
              {view === 'pipeline' && !deal && (
                <TradeOperations
                  trades={trades}
                  onDealSelect={(id) => setDeal(id)}
                  role={role as string}
                />
              )}
              {view === 'portfolio' && !deal && <Portfolio />}
              {view === 'risk_calc' && !deal && role !== 'ops_admin' && (
                <div className="fade-in">
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Risk Intelligence Center</h2>
                    <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Run quantitative assessment simulations for prospective trades.</p>
                  </div>
                  <RiskAssessmentTool
                    onSave={(data) => notify(`Simulation saved: Total Score ${data.risk_score}/100. Recommendations: ${data.recommendations?.[0]}`)}
                  />
                </div>
              )}
              {view === 'buyers' && !deal && (
                <BuyerIntelligence
                  onNotify={notify}
                  onOpenBuyerEdit={(id) => {
                    setEditingBuyerId(id);
                    navigateToView('buyer_edit');
                  }}
                />
              )}
              {view === 'buyer_edit' && editingBuyerId && !deal && (
                <AdminBuyerEditPage
                  buyerId={editingBuyerId}
                  onNotify={notify}
                  onBack={() => {
                    setEditingBuyerId(null);
                    navigateBack();
                  }}
                />
              )}
              {view === 'aggregators' && !deal && (role === 'ceo' || role === 'ops_admin' || role === 'deal_officer') && (
                <AggregatorIntelligence
                  onNotify={notify}
                  onOpenAggregatorEdit={(id) => {
                    setEditingAggregatorId(id);
                    navigateToView('aggregator_edit');
                  }}
                />
              )}
              {view === 'aggregator_edit' && editingAggregatorId && !deal && (role === 'ceo' || role === 'ops_admin' || role === 'deal_officer') && (
                <AdminAggregatorEditPage
                  aggregatorId={editingAggregatorId}
                  onNotify={notify}
                  onBack={() => {
                    setEditingAggregatorId(null);
                    navigateBack();
                  }}
                />
              )}
              {view === 'fp_crm' && !deal && role !== 'ops_admin' && <FinancePartnerCRM />}
              {(role === 'ceo' || role === 'ops_admin') && (
                <>
                  {view === 'admin_onboard' && !deal && (
                    <UserManagementHub
                      onNotify={notify}
                      onBack={navigateBack}
                      currentUserId={user?.id}
                      onEditUserProfile={(id) => {
                        setAdminEditingUserId(id);
                        navigateToView('admin_user_edit');
                      }}
                      onOpenVerificationInbox={(orgId) => {
                        setSelectedVerificationTraderId(orgId);
                        navigateToView('admin_verify');
                      }}
                    />
                  )}
                  {view === 'admin_user_edit' && adminEditingUserId && !deal && (
                    <AdminUserEditPage
                      userId={adminEditingUserId}
                      onNotify={notify}
                      onBack={() => {
                        setAdminEditingUserId(null);
                        navigateBack();
                      }}
                    />
                  )}
                </>
              )}
              {(role === 'ceo' || role === 'ops_admin') && view === 'admin_verify' && !deal && (
                <VerificationInBox
                  onNotify={notify}
                  targetOrgId={selectedVerificationTraderId}
                  onBack={navigateBack}
                />
              )}
              {(role === 'ceo' || role === 'ops_admin') && view === 'admin_audit' && !deal && (
                <AuditLogViewer onNotify={notify} onBack={navigateBack} />
              )}
              {view === 'settle' && !deal && (
                <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
                  <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center', color: 'var(--cr)' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 12 3-9 3 9H3Z" fill="currentColor" fillOpacity="0.1" />
                      <path d="m15 12 3-9 3 9h-6Z" fill="currentColor" fillOpacity="0.1" />
                      <path d="M12 3v18" />
                      <path d="M21 12H3" />
                      <path d="M12 21H5" />
                      <path d="M12 21h7" />
                      <circle cx="12" cy="2" r="1" fill="currentColor" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: '22px', color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.02em' }}>Settlement & Waterfall</h2>
                  <p style={{ marginTop: '10px', color: '#6B7280' }}>Please select a trade from the Pipeline or Monitor to manage its settlement.</p>
                  <Button
                    variant="secondary"
                    style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    onClick={() => navigateToView('pipeline')}
                  >
                    <span style={{ display: 'inline-flex', flexShrink: 0 }} aria-hidden>
                      <TradeApplicationIcon size={18} />
                    </span>
                    Go to Trade Operations
                  </Button>
                </div>
              )}
            </>
          )}

          {role === 'finance_partner' && (
            <FinancePartnerPortal
              trades={trades}
              onNotify={notify}
              view={view}
              setView={setView}
              onRefresh={fetchTrades}
            />
          )}

          {role === 'trader' && view.startsWith('trs_') && (
            <TraderPortal
              trades={trades}
              onNotify={notify}
              view={view}
              onViewChange={handleViewChange}
              onRefresh={fetchTrades}
            />
          )}

          {view === 'admin_notifications' && !deal && (
            <NotificationsInbox
              onNotify={notify}
              onBack={() => {
                setSelectedNotificationId(null);
                navigateBack();
              }}
              initialNotificationId={selectedNotificationId}
              onNotificationsChange={handleNotificationsChange}
            />
          )}

          {deal && (
            <DealDetail
              dealId={deal}
              trades={trades}
              onBack={() => setDeal(null)}
              role={role || ''}
              onUpdateTrade={(id, updates) => {
                setTrades(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
              }}
              onNotify={notify}
              onRefresh={fetchTrades}
            />
          )}
        </div>
      </div>

      <BottomNav
        role={role}
        view={view}
        onViewChange={handleViewChange}
        onOpenMore={() => setIsSidebarOpen(true)}
      />

      <ConfirmDialog
        isOpen={showConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes in your form. If you leave this page now, your progress will be lost. Are you sure you want to proceed?"
        confirmLabel="Leave Page"
        cancelLabel="Stay Here"
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        variant="warning"
      />

      {user && role && (
        <SessionTimer
          onSessionExpired={handleLogout}
          onExtendSession={handleExtendSession}
        />
      )}
    </div>
  );
};
