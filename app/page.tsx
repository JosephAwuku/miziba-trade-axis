"use client";

import React, { useState, useEffect } from 'react';
import { Role, View, Trade } from '@/lib/types';
import { TRADES as initialTrades } from '@/lib/data';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Login from '@/components/Login';
import { Button } from '@/components/ui';
import DealDetail from '@/components/views/DealDetail';
import Portfolio from '@/components/views/Portfolio';
import Settlement from '@/components/views/Settlement';
import BuyerIntelligence from '@/components/views/BuyerIntelligence';
import TraderPortal from '@/components/views/TraderPortal';
import FinancePartnerPortal from '@/components/views/FinancePartnerPortal';
import FinancePartnerCRM from '@/components/views/FinancePartnerCRM';
import RiskAssessmentTool from '@/components/RiskAssessmentTool';
import UserManagementHub from '@/components/admin/UserManagementHub';
import TradeOperations from '@/components/views/TradeOperations';

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
      // Fallback to initial trades for demo if API fails
      setTrades(initialTrades);
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

  const handleLoginSuccess = (user: any, role: Role) => {
    setUser(user);
    setRole(role);
    
    const token = user.id === 'demo' || user.id === 'test-user' ? 'mock-dev-token' : null;
    if (token) {
      apiClient.setToken(token);
    }
    
    // Persist session
    localStorage.setItem('tradeaxis_session', JSON.stringify({ user, role, token }));
    
    // Set appropriate initial view
    if (role === 'trader') {
      setView('trs_overview');
    } else if (role === 'cfo') {
      setView('pipeline');
    } else if (role === 'finance_partner' || role === 'fp') {
      setView('monitor');
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

  const handleViewChange = (v: View) => {
    setView(v);
    setDeal(null);
    
    // Save view to existing session
    const savedSession = localStorage.getItem('tradeaxis_session');
    if (savedSession) {
      const session = JSON.parse(savedSession);
      localStorage.setItem('tradeaxis_session', JSON.stringify({ ...session, view: v }));
    }
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
    fp_inbox: 'Deal Inbox',
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
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚖️</div>
                  <h2 style={{ fontSize: '20px', color: 'var(--text3)', fontWeight: 700 }}>Settlement & Waterfall</h2>
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
    </div>
  );
}
