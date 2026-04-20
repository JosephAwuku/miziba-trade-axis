"use client";

import React, { useState, useEffect } from 'react';
import { Role, View, Trade } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import BottomNav from '@/components/BottomNav';
import Login from '@/components/Login';
import { Button, Card } from '@/components/ui';
import { usd } from '@/lib/utils';
import DealDetail from '@/components/views/DealDetail';
import Portfolio from '@/components/views/Portfolio';
import Settlement from '@/components/views/Settlement';
import BuyerIntelligence from '@/components/views/BuyerIntelligence';
import TraderPortal from '@/components/views/TraderPortal';
import FinancePartnerPortal from '@/components/views/FinancePartnerPortal';
import FinancePartnerCRM from '@/components/views/FinancePartnerCRM';
import UserManagementHub from '@/components/admin/UserManagementHub';
import TradeOperations from '@/components/views/TradeOperations';
import RiskAssessmentTool from '@/components/RiskAssessmentTool';
import { useNavigation } from '@/lib/contexts/NavigationContext';
import { ConfirmDialog } from '@/components/ui';

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

  const notify = (msg: string, type: string = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

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
  }, [role, view]);

  const fetchTrades = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiClient.isAuthenticated()) {
        setLoading(false);
        return;
      }
      // In production, session is already set by Supabase Auth
      const response = await apiClient.getTrades();
      
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
        kyc: t.kyc_status as any,
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
      setError(err.message || 'Failed to load trades. Please check your connection.');
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

  const handleLoginSuccess = (user: any, role: Role, token?: string) => {
    setUser(user);
    setRole(role);
    
    if (token) {
      apiClient.setToken(token);
    }
    
    // Persist session
    localStorage.setItem('tradeaxis_session', JSON.stringify({ user, role, token }));
    
    // Set appropriate initial view
    if (role === 'trader') {
      setView('trs_overview');
    } else if (role === 'cfo') {
      setView('cfo_overview');
    } else if (role === 'finance_partner' || role === 'fp') {
      setView('fp_overview');
    } else if (role === 'ceo') {
      setView('ceo_overview');
    } else if (role === 'ops_admin') {
      setView('ops_overview');
    } else {
      setView('pipeline');
    }
    
    setDeal(null);
  };

  const handleLogout = () => {
    setRole(null);
    setUser(null);
    apiClient.setToken('');
    localStorage.removeItem('tradeaxis_session');
  };

  const { requestNavigation, showConfirm, confirmNavigation, cancelNavigation } = useNavigation();

  const handleViewChange = (v: View) => {
    requestNavigation(v, (nextView) => {
      setView(nextView);
      setDeal(null);
      
      // Save view to existing session
      const savedSession = localStorage.getItem('tradeaxis_session');
      if (savedSession) {
        const session = JSON.parse(savedSession);
        localStorage.setItem('tradeaxis_session', JSON.stringify({ ...session, view: nextView }));
      }
    });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, deal, tab]);

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
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const roleLabel = { deal_officer: 'Deal Officer', ceo: 'Head of Trade / CEO', cfo: 'CFO', trader: 'Trader', fp: 'Finance Partner' }[role as string] || role;
  
  // Logic for Traders/FP portals would go here in original, 
  // for now focusing on Internal Shell
  
  const viewLabels: Record<string, string> = {
    pipeline: 'Trade Operations',
    portfolio: 'Portfolio',
    risk_calc: 'Risk Calculator',
    buyers: 'Buyer Database',
    fp_crm: 'Finance Partner CRM',
    settle: 'Settlement',
    trs_status: 'Trade Applications',
    trs_apply: 'New Trade Application',
    trs_settle: 'Settlement Portal',
    trs_verify: 'Company Verification',
    trs_overview: 'Dashboard Overview',
    fp_overview: 'Dashboard Overview',
    fp_inbox: 'Pending Requests',
    fp_portfolio: 'My Portfolio',
    fp_reports: 'Settlement Reports',
    fp_onboarding: 'Onboarding',
    admin_onboard: 'User Management',
    admin_directory: 'User Directory',
    admin_verify: 'Verification Inbox'
  };

  const currentViewLabel = deal ? 'Deal Detail' : viewLabels[view] || '';

  return (
    <div className="app">
      {notification && (
        <div id="notif" className="show" style={{ 
          background: notification.type === 'error' ? 'var(--da-bg)' : 'var(--su-bg)',
          color: notification.type === 'error' ? 'var(--da)' : 'var(--su)',
          border: `1px solid ${notification.type === 'error' ? 'var(--da-b)' : 'var(--su-b)'}`
        }}>
          {notification.type === 'error' ? '⚠' : '✓'} {notification.msg}
        </div>
      )}

      <Sidebar 
        role={role}
        view={view}
        deal={deal}
        trades={trades}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
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
        />
        
        <div className="content fade-in">
          {(role === 'deal_officer' || role === 'ceo' || role === 'cfo' || role === 'ops_admin') && (
            <>
              {view === 'ceo_overview' && !deal && (
                <div className="fade-in">
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Strategic Command Center</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text2)' }}>High-level portfolio performance, capital tracking, and risk breakdown.</p>
                  </div>

                  <div className="g3" style={{ marginBottom: '32px' }}>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>TOTAL DEPLOYED CAPITAL</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{usd(trades.filter(t => ['FUNDED', 'PROCURING', 'DELIVERED'].includes(t.stage)).reduce((a, t) => a + t.ff, 0))}</div>
                      <div style={{ fontSize: '12px', color: '#16A34A', marginTop: '6px', fontWeight: 600 }}>Zero defaults reported</div>
                    </Card>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>ELEVATED RISK TRANSACTIONS</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--cr)' }}>{trades.filter(t => (t.risk || 0) < 55).length}</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Requires CEO override to proceed</p>
                    </Card>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>UPCOMING SETTLEMENTS</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{trades.filter(t => t.stage === 'DELIVERED').length}</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Facilities ready for CFO resolution</p>
                    </Card>
                  </div>

                  <div className="g2-responsive" style={{ marginBottom: '24px' }}>
                    <Card style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Action Required</h3>
                            <Button variant="secondary" size="sm" onClick={() => setView('pipeline')}>View Pipeline</Button>
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
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{t.tr} · {t.cmd}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{usd(t.cv)} · {t.risk && t.risk < 55 ? 'Elevated Risk Escalation' : 'Final Validation'}</div>
                                        </div>
                                        <Button variant="primary" size="sm" onClick={() => { setView('pipeline'); setDeal(t.id); }}>Review Deal</Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    <Card style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Strategic Hub</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('fp_crm')}>
                                <span style={{ marginRight: '10px' }}>◆</span> Finance Partner CRM
                            </Button>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('risk_calc')}>
                                <span style={{ marginRight: '10px' }}>⬡</span> Risk Assessment Tool
                            </Button>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('buyers')}>
                                <span style={{ marginRight: '10px' }}>●</span> Buyer Database
                            </Button>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('admin_onboard')}>
                                <span style={{ marginRight: '10px' }}>▦</span> User Management
                            </Button>
                        </div>
                    </Card>
                  </div>
                </div>
              )}

              {view === 'ops_overview' && !deal && (
                <div className="fade-in">
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>System Health Dashboard</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text2)' }}>Operational monitoring and pending user verification queues.</p>
                  </div>

                  <div className="g3" style={{ marginBottom: '32px' }}>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>PENDING VERIFICATIONS</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>3</div>
                      <div style={{ fontSize: '12px', color: '#16A34A', marginTop: '6px', fontWeight: 600 }}>Requires manual review</div>
                    </Card>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>SYSTEM UPTIME</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>99.9%</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>All services operational</p>
                    </Card>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>ACTIVE INTEGRATIONS</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>2/3</div>
                      <p style={{ fontSize: '12px', color: '#D97706', marginTop: '6px' }}>DocuSign API degraded</p>
                    </Card>
                  </div>

                  <div className="g2-responsive" style={{ marginBottom: '24px' }}>
                    <Card style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>System Audit Log</h3>
                            <Button variant="secondary" size="sm">Export Logs</Button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #F1F5F9' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>User Created</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>john.doe@finance.partner.com</div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>2 mins ago</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #F1F5F9' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Trade Advanced: TX-2024-089</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>State changed SUBMITTED → VALIDATED</div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>1 hour ago</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Webhook Failed: DocuSign Envelop</div>
                                    <div style={{ fontSize: '11px', color: '#D97706' }}>Retrying...</div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>3 hours ago</div>
                            </div>
                        </div>
                    </Card>

                    <Card style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Admin Controls</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('admin_onboard')}>
                                <span style={{ marginRight: '10px' }}>▦</span> User Management
                            </Button>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('buyers')}>
                                <span style={{ marginRight: '10px' }}>●</span> Buyer Database
                            </Button>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }}>
                                <span style={{ marginRight: '10px' }}>⚙</span> Integration Settings
                            </Button>
                        </div>
                    </Card>
                  </div>
                </div>
              )}
              {view === 'cfo_overview' && !deal && (
                <div className="fade-in">
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Financial Command Center</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text2)' }}>High-level liquidity oversight and pipeline performance metrics.</p>
                  </div>

                  <div className="g4" style={{ marginBottom: '32px' }}>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>TOTAL PIPELINE VALUE</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{usd(trades.reduce((a, t) => a + t.cv, 0))}</div>
                      <div style={{ fontSize: '12px', color: '#16A34A', marginTop: '6px', fontWeight: 600 }}>↑ 12% vs last month</div>
                    </Card>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>ACTIVE CAPITAL DEPLOYED</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{usd(trades.reduce((a, t) => a + t.ff, 0))}</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Across {trades.filter(t => t.stage === 'FUNDED').length} active facilities</p>
                    </Card>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>AVG FACILITY TENOR</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>42 Days</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Average cycle to settlement</p>
                    </Card>
                    <Card style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '8px' }}>NET YIELD (EST.)</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--cr)' }}>1.5%</div>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '6px' }}>Per cycle after partner fees</p>
                    </Card>
                  </div>

                  <div className="g2-responsive" style={{ marginBottom: '24px' }}>
                    <Card style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Pending Financial Actions</h3>
                            <Button variant="secondary" size="sm" onClick={() => setView('settle')}>Manage Settlements</Button>
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
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{t.tr} · {t.cmd}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{usd(t.cv)} worth of goods delivered</div>
                                        </div>
                                        <Button variant="primary" size="sm" onClick={() => setView('settle')}>Calculate Waterfall</Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    <Card style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Quick Access</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('fp_crm')}>
                                <span style={{ marginRight: '10px' }}>◆</span> Finance Partner CRM
                            </Button>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('risk_calc')}>
                                <span style={{ marginRight: '10px' }}>⬡</span> Risk Assessment Tool
                            </Button>
                            <Button variant="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => setView('buyers')}>
                                <span style={{ marginRight: '10px' }}>●</span> Buyer Database
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
              {view === 'risk_calc' && !deal && (
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
              {view === 'buyers' && !deal && <BuyerIntelligence />}
              {view === 'fp_crm' && !deal && <FinancePartnerCRM />}
              {(role === 'ceo' || role === 'ops_admin') && (
                <>
                  {view === 'admin_onboard' && !deal && <UserManagementHub onNotify={notify} />}
                </>
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
                    style={{ marginTop: '20px' }} 
                    onClick={() => setView('monitor')}
                  >
                    Go to Active Monitor
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
            />
          )}

          {role === 'trader' && view.startsWith('trs_') && (
            <TraderPortal 
              trades={trades} 
              onNotify={notify} 
              view={view} 
              onViewChange={handleViewChange}
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
    </div>
  );
};
