"use client";

import React from 'react';
import { Role, View, Trade } from '@/lib/types';
import { usd } from '@/lib/utils';

interface SidebarProps {
  role: Role;
  view: View;
  deal: string | null;
  trades: Trade[];
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
  trades,
}) => {
  const activeDealsCount = trades.filter(t => !['SETTLED', 'CLOSED'].includes(t.stage)).length;
  const portfolioValue = trades.reduce((a, t) => a + t.cv, 0);
  const rScores = trades.filter(t => t.risk);
  const avgRiskScore = rScores.length ? Math.round(rScores.reduce((a, t) => a + (t.risk || 0), 0) / rScores.length) : 0;

  const getNavItems = () => {
    if (role === 'cfo') {
      return [
        { id: 'cfo_overview', i: '⬢', l: 'Dashboard Overview' },
        { id: 'pipeline', i: '▦', l: 'Trade Operations' },
        { id: 'settle', i: '◈', l: 'Settlement' },
        { id: 'portfolio', i: '◉', l: 'Portfolio' },
        { id: 'fp_crm', i: '◆', l: 'Finance Partner CRM' },
        { id: 'risk_calc', i: '⬡', l: 'Risk Calculator' },
        { id: 'buyers', i: '●', l: 'Buyer Database' }
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
        { id: 'fp_overview', i: '⬢', l: 'Dashboard Overview' },
        { id: 'fp_inbox', i: '▦', l: 'Pending Requests' },
        { id: 'fp_portfolio', i: '◈', l: 'My Portfolio' },
        { id: 'fp_reports', i: '●', l: 'Settlement Reports' },
        { id: 'fp_onboarding', i: '⬢', l: 'Onboarding' }
      ];
    }
    if (role === 'ceo') {
      return [
        { id: 'ceo_overview', i: '⬢', l: 'Strategic Overview' },
        { id: 'pipeline', i: '▦', l: 'Trade Operations' },
        { id: 'portfolio', i: '◈', l: 'Portfolio' },
        { id: 'fp_crm', i: '◆', l: 'Finance Partner CRM' },
        { id: 'risk_calc', i: '⬡', l: 'Risk Calculator' },
        { id: 'buyers', i: '●', l: 'Buyer Database' },
        { id: 'admin_onboard', i: '▦', l: 'User Management' }
      ];
    }
    if (role === 'ops_admin') {
      return [
        { id: 'ops_overview', i: '⬢', l: 'System Health' },
        { id: 'admin_onboard', i: '▦', l: 'User Management' },
        { id: 'buyers', i: '●', l: 'Buyer Database' }
      ];
    }
    return [
      { id: 'pipeline', i: '▦', l: 'Trade Operations' },
      { id: 'portfolio', i: '◈', l: 'Portfolio' },
      { id: 'risk_calc', i: '⬡', l: 'Risk Calculator' },
      { id: 'buyers', i: '●', l: 'Buyer Database' },
      { id: 'fp_crm', i: '◆', l: 'Finance Partner CRM' }
    ];
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
        <button className="sb-close" onClick={onClose}>✕</button>
        <div className="sb-brand" style={{ borderBottom: '1px solid var(--bdr)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="logo-box" style={{ width: '32px', height: '32px', fontSize: '18px' }}>T</div>
            <div>
              <div className="sb-title" style={{
                color: 'var(--text)',
                fontSize: '18px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1
              }}>
                {isFP ? 'Ecobank DFI' : 'TradeAxis'}
              </div>
              <div className="sb-ver" style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>{roleLabel}</div>
            </div>
          </div>
        </div>
        <nav className="sb-nav" style={{ padding: '8px 6px' }}>
          {navItems.map((n) => (
            <button
              key={n.id}
              className={`nb ${view === n.id && !deal ? 'on' : ''}`}
              style={{
                color: view === n.id && !deal ? 'var(--cr)' : 'var(--text2)',
                background: view === n.id && !deal ? 'var(--cr-bg)' : 'transparent',
                borderColor: view === n.id && !deal ? 'var(--cr-b)' : 'transparent',
                padding: '9px 12px',
                marginBottom: '4px'
              }}
              onClick={() => {
                onViewChange(n.id as View);
                onClose();
              }}
            >
              <span className="nb-icon" style={{ 
                opacity: view === n.id ? 1 : 0.5,
                fontSize: '16px'
              }}>{n.i}</span>
              <span style={{ fontWeight: view === n.id ? 700 : 500 }}>{n.l}</span>
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
