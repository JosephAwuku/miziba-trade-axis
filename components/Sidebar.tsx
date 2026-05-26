"use client";

import React from 'react';
import { Role, View } from '@/lib/types';
import { UsersManagementIcon } from '@/components/icons/UsersManagementIcon';
import { SystemOverviewIcon } from '@/components/icons/SystemOverviewIcon';
import { AuditLogIcon } from '@/components/icons/AuditLogIcon';
import { RequiredActionIcon } from '@/components/icons/RequiredActionIcon';
import { TradeApplicationIcon } from '@/components/icons/TradeApplicationIcon';
import { BuyerDatabaseIcon } from '@/components/icons/BuyerDatabaseIcon';
import { AggregatorDatabaseIcon } from '@/components/icons/AggregatorDatabaseIcon';
import { PortfolioIcon } from '@/components/icons/PortfolioIcon';
import { CompanyProfileIcon } from '@/components/icons/CompanyProfileIcon';
import { PaymentsIcon } from '@/components/icons/PaymentsIcon';
import { PlusIcon } from '@/components/icons/PlusIcon';
import { DraftsIcon } from '@/components/icons/DraftsIcon';

interface SidebarProps {
  role: Role;
  view: View;
  deal: string | null;
  user?: { full_name?: string; email?: string } | null;
  onViewChange: (view: View) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  role,
  view,
  deal,
  user,
  onViewChange,
  isOpen,
  onClose,
}) => {
  const getNavItems = () => {
    if (role === 'cfo') {
      return [
        { id: 'cfo_overview', i: '⬢', l: 'Finance Officer Overview' },
        { id: 'pipeline', i: '▦', l: 'Trade Operations' },
        { id: 'settle', i: '◈', l: 'Settlement' },
        { id: 'portfolio', i: '◉', l: 'Portfolio' },
        { id: 'fp_crm', i: '◆', l: 'Finance Partners' },
        { id: 'risk_calc', i: '⬡', l: 'Risk Calculator' },
        { id: 'buyers', i: '●', l: 'Buyer Database' }
      ];
    }
    if (role === 'trader') {
      return [
        { id: 'trs_overview', i: '⬢', l: 'Dashboard Overview' },
        { id: 'trs_status', i: '◎', l: 'Trade Applications' },
        { id: 'trs_apply', i: '+', l: 'New Trade Application' },
        { id: 'trs_drafts', i: '📝', l: 'Drafts' },
        { id: 'trs_company', i: '◈', l: 'Company Profile' },
        { id: 'trs_settle', i: '⬢', l: 'Payments' }
      ];
    }
    if (role === 'finance_partner') {
      return [
        { id: 'fp_overview', i: '⬢', l: 'Finance Partner Overview' },
        { id: 'fp_inbox', i: '▦', l: 'Pending Requests' },
        { id: 'fp_portfolio', i: '◈', l: 'Finance Partner Portfolio' },
        { id: 'fp_reports', i: '●', l: 'Settlement Reports' },
        { id: 'fp_onboarding', i: '⬢', l: 'Onboarding' }
      ];
    }
    if (role === 'ceo') {
      return [
        { id: 'ceo_overview', i: '⬢', l: 'Strategic Overview' },
        { id: 'pipeline', i: '▦', l: 'Trade Operations' },
        { id: 'portfolio', i: '◈', l: 'Portfolio' },
        { id: 'fp_crm', i: '◆', l: 'Finance Partners' },
        { id: 'risk_calc', i: '⬡', l: 'Risk Calculator' },
        { id: 'buyers', i: '●', l: 'Buyer Database' },
        { id: 'aggregators', i: '◐', l: 'Aggregator Database' },
        { id: 'admin_onboard', i: '▦', l: 'User Management' },
        { id: 'admin_verify', i: '◉', l: 'Required Action' },
        { id: 'admin_audit', i: '◎', l: 'Audit Log' }
      ];
    }
    if (role === 'ops_admin') {
      return [
        { id: 'ops_overview', i: '⬢', l: 'System Overview' },
        { id: 'admin_onboard', i: '▦', l: 'User Management' },
        { id: 'admin_verify', i: '◉', l: 'Required Action' },
        { id: 'buyers', i: '●', l: 'Buyer Database' },
        { id: 'aggregators', i: '◐', l: 'Aggregator Database' },
        { id: 'pipeline', i: '▦', l: 'Trade Operations' },
        { id: 'portfolio', i: '◈', l: 'Portfolio' },
        { id: 'admin_audit', i: '◎', l: 'Audit Log' },
      ];
    }
    if (role === 'deal_officer') {
      return [
        { id: 'pipeline', i: '▦', l: 'Trade Operations' },
        { id: 'portfolio', i: '◈', l: 'Portfolio' },
        { id: 'risk_calc', i: '⬡', l: 'Risk Calculator' },
        { id: 'buyers', i: '●', l: 'Buyer Database' },
        { id: 'aggregators', i: '◐', l: 'Aggregator Database' },
        { id: 'fp_crm', i: '◆', l: 'Finance Partners' }
      ];
    }
    return [];
  };

  const navItems = getNavItems();
  const isFP = role === 'finance_partner';
  const displayName = user?.full_name?.trim() || 'Signed in';
  const displayEmail = user?.email || '';

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
              <span
                className="nb-icon"
                style={{
                  opacity: view === n.id ? 1 : 0.5,
                  fontSize: "16px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "inherit",
                }}
              >
                {n.id === "admin_onboard" ? (
                  <UsersManagementIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "ops_overview" ? (
                  <SystemOverviewIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "trs_overview" ? (
                  <SystemOverviewIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "trs_company" ? (
                  <CompanyProfileIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "trs_settle" ? (
                  <PaymentsIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "trs_apply" ? (
                  <PlusIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "trs_drafts" ? (
                  <DraftsIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "admin_audit" ? (
                  <AuditLogIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "admin_verify" ? (
                  <RequiredActionIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "pipeline" ? (
                  <TradeApplicationIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "trs_status" ? (
                  <TradeApplicationIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "portfolio" || n.id === "fp_portfolio" ? (
                  <PortfolioIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "buyers" ? (
                  <BuyerDatabaseIcon size={18} style={{ opacity: 1 }} />
                ) : n.id === "aggregators" ? (
                  <AggregatorDatabaseIcon size={18} style={{ opacity: 1 }} />
                ) : (
                  n.i
                )}
              </span>
              <span style={{ fontWeight: view === n.id ? 700 : 500 }}>{n.l}</span>
            </button>
          ))}
        </nav>

        <div className="sb-user" style={{ borderTop: '1px solid var(--bdr)' }}>

          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text)', fontSize: '15px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            {displayEmail && (
              <div style={{ color: '#64748B', fontSize: '12.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayEmail}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
