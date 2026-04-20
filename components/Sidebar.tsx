"use client";

import React from 'react';
import { Role, View } from '@/lib/types';
import { usd } from '@/lib/utils';
import { TRADES } from '@/lib/data';

interface SidebarProps {
  role: Role;
  view: View;
  deal: string | null;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  role,
  view,
  deal,
  onViewChange,
  onLogout,
  isOpen,
  onClose,
}) => {
  const activeDealsCount = TRADES.filter(t => !['SETTLED', 'CLOSED'].includes(t.stage)).length;
  const portfolioValue = TRADES.reduce((a, t) => a + t.cv, 0);
  const rScores = TRADES.filter(t => t.risk);
  const avgRiskScore = rScores.length ? Math.round(rScores.reduce((a, t) => a + (t.risk || 0), 0) / rScores.length) : 0;

  const getNavItems = () => {
    if (role === 'cfo') {
      return [
        { id: 'pipeline', i: '▦', l: 'Trade Operations' },
        { id: 'settle', i: '⬢', l: 'Settlement' },
        { id: 'portfolio', i: '◈', l: 'Portfolio' },
      ];
    }
    if (role === 'trader') {
      return [
        { id: 'trs_overview', i: '⬢', l: 'Dashboard Overview' },
        { id: 'trs_status', i: '◎', l: 'Trade Applications' },
        { id: 'trs_apply', i: '+', l: 'New Trade Application' },
        { id: 'trs_verify', i: '✓', l: 'Company Verification' },
        { id: 'trs_docs', i: '◈', l: 'Documents' },
        { id: 'trs_settle', i: '⬢', l: 'Settlement' }
      ];
    }
    if (role === 'finance_partner') {
      return [
        { id: 'fp_inbox', i: '▦', l: 'Deal Inbox' },
        { id: 'fp_portfolio', i: '◈', l: 'My Portfolio' },
        { id: 'fp_reports', i: '●', l: 'Settlement Reports' },
        { id: 'fp_onboarding', i: '⬢', l: 'Onboarding' }
      ];
    }
    const items = [
      { id: 'pipeline', i: '▦', l: 'Trade Operations' },
      { id: 'portfolio', i: '◈', l: 'Portfolio' },
      { id: 'risk_calc', i: '⬡', l: 'Risk Calculator' },
      { id: 'buyers', i: '●', l: 'Buyer Database' },
      { id: 'fp_crm', i: '◆', l: 'Finance Partner CRM' }
    ];

    if (role === 'ceo' || role === 'ops_admin') {
      items.push(
        { id: 'admin_onboard', i: '▦', l: 'User Management' }
      );
    }

    return items;
  };

  const navItems = getNavItems();
  const roleLabel = { 
    deal_officer: 'Deal Officer', 
    ceo: 'Head of Trade / CEO', 
    cfo: 'CFO', 
    trader: 'Trader', 
    finance_partner: 'Finance Partner',
    ops_admin: 'Operations Admin'
  }[role as string] || role;
  
  const isFP = role === 'finance_partner' || role === 'fp';

  return (
    <>
      <div id="sbo" className={`sb-overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>
      <div 
        id="sb" 
        className={`sb ${isOpen ? 'open' : ''}`} 
        style={{ 
          background: '#fff',
          borderRight: '1px solid var(--bdr)'
        }}
      >
        <button className="sb-close" style={{ color: '#9CA3AF' }} onClick={onClose}>✕</button>
        <div className="sb-brand" style={{ borderBottom: '1px solid var(--bdr)' }}>
          <div className="logo-box" style={isFP ? { background: 'linear-gradient(135deg,#C9943A,#8B6914)' } : undefined}>
            {isFP ? 'E' : 'T'}
          </div>
          <div>
            <div className="sb-title" style={{ color: 'var(--text)' }}>
              {isFP ? 'Ecobank DFI Fund' : 'TradeAxis'}
            </div>
            <div className="sb-ver">{roleLabel} · v2.0</div>
          </div>
        </div>
        <nav className="sb-nav">
          {navItems.map((n) => (
            <button
              key={n.id}
              className={`nb ${view === n.id && !deal ? 'on' : ''}`}
              style={isFP ? {
                color: view === n.id ? '#8B6914' : 'var(--text2)',
                background: view === n.id ? 'rgba(201,148,58,.12)' : 'transparent',
                borderColor: view === n.id ? 'rgba(201,148,58,.25)' : 'transparent'
              } : {
                color: view === n.id ? 'var(--cr)' : 'var(--text2)',
                background: view === n.id && !deal ? 'var(--cr-bg)' : 'transparent',
                borderColor: view === n.id && !deal ? 'var(--cr-b)' : 'transparent',
              }}
              onClick={() => {
                onViewChange(n.id as View);
                onClose();
              }}
            >
              <span className="nb-icon" style={{ opacity: view === n.id ? 1 : 0.6 }}>{n.i}</span>
              {n.l}
            </button>
          ))}
        </nav>
        
        {role !== 'trader' && (
          <div className="sb-snap" style={{ borderTop: '1px solid var(--bdr)', background: '#F8FAFC' }}>
            <div style={{ color: '#64748B', fontSize: '10px', fontWeight: 800, letterSpacing: '.08em', marginBottom: '8px', padding: '0 4px' }}>OPERATIONAL SNAPSHOT</div>
            <div className="snap-row" style={{ color: '#475569', padding: '0 4px' }}>
              <span>Active deals</span>
              <span className="mono" style={{ color: 'var(--text)', fontWeight: 700 }}>{activeDealsCount}</span>
            </div>
            <div className="snap-row" style={{ color: '#475569', padding: '0 4px' }}>
              <span>Portfolio value</span>
              <span className="mono" style={{ color: 'var(--text)', fontWeight: 700 }}>{usd(portfolioValue)}</span>
            </div>
            <div className="snap-row" style={{ color: '#475569', padding: '0 4px' }}>
              <span>Avg risk score</span>
              <span className="mono" style={{ color: 'var(--text)', fontWeight: 700 }}>{avgRiskScore}/100</span>
            </div>
            <div className="snap-row" style={{ color: '#475569', padding: '0 4px' }}>
              <span>Default rate</span>
              <span className="mono" style={{ color: '#16A34A', fontWeight: 700 }}>0%</span>
            </div>
          </div>
        )}
 
        <div className="sb-user" style={{ borderTop: '1px solid var(--bdr)' }}>
          <div className="av" style={{ background: isFP ? '#C9943A' : '#1B2B4D' }}>
            {role.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {role === 'finance_partner' ? 'Relationship Manager' : 'Operations Staff'}
            </div>
            <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 500 }}>{roleLabel}</div>
          </div>
          <button className="logout-btn" style={{ color: '#94A3B8' }} onClick={onLogout}>⎏</button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
