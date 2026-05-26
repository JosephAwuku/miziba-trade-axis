"use client";

import React from 'react';
import { Role, View } from '@/lib/types';
import { UsersManagementIcon } from '@/components/icons/UsersManagementIcon';
import { SystemOverviewIcon } from '@/components/icons/SystemOverviewIcon';
import { RequiredActionIcon } from '@/components/icons/RequiredActionIcon';
import { TradeApplicationIcon } from '@/components/icons/TradeApplicationIcon';
import { BuyerDatabaseIcon } from '@/components/icons/BuyerDatabaseIcon';
import { PortfolioIcon } from '@/components/icons/PortfolioIcon';
import { PlusIcon } from '@/components/icons/PlusIcon';

interface BottomNavProps {
  role: Role;
  view: View;
  onViewChange: (view: View) => void;
  onOpenMore: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ role, view, onViewChange, onOpenMore }) => {
  const getNavItems = () => {
    let items = [];
    if (role === 'cfo') {
      items = [
        { id: 'cfo_overview', i: '⬢', l: 'Stats' },
        { id: 'pipeline', i: '▦', l: 'Ops' },
        { id: 'portfolio', i: '◈', l: 'Deals' },
        { id: 'fp_crm', i: '◆', l: 'Partners' }
      ];
    } else if (role === 'trader') {
      items = [
        { id: 'trs_overview', i: '⬢', l: 'Home' },
        { id: 'trs_status', i: '◎', l: 'Status' },
        { id: 'trs_apply', i: '+', l: 'Apply' },
        { id: 'trs_docs', i: '◈', l: 'Docs' }
      ];
    } else if (role === 'finance_partner') {
      items = [
        { id: 'fp_overview', i: '⬢', l: 'Stats' },
        { id: 'fp_inbox', i: '▦', l: 'Inbox' },
        { id: 'fp_portfolio', i: '◈', l: 'Partner Portfolio' },
        { id: 'fp_reports', i: '●', l: 'Reports' }
      ];
    } else if (role === 'ceo') {
      items = [
        { id: 'ceo_overview', i: '⬢', l: 'Strategy' },
        { id: 'pipeline', i: '▦', l: 'Ops' },
        { id: 'portfolio', i: '◈', l: 'Assets' },
        { id: 'fp_crm', i: '◆', l: 'Capital' }
      ];
    } else if (role === 'ops_admin') {
      items = [
        { id: 'ops_overview', i: '⬢', l: 'Overview' },
        { id: 'admin_onboard', i: '▦', l: 'Users' },
        { id: 'admin_verify', i: '◉', l: 'Actions' },
        { id: 'pipeline', i: '▦', l: 'Trades' },
      ];
    } else if (role === 'deal_officer') {
      items = [
        { id: 'pipeline', i: '▦', l: 'Ops' },
        { id: 'portfolio', i: '◈', l: 'Deals' },
        { id: 'risk_calc', i: '⬡', l: 'Risk' },
        { id: 'buyers', i: '●', l: 'Buyers' },
      ];
    } else {
      items = [
        { id: 'pipeline', i: '▦', l: 'Ops' },
        { id: 'portfolio', i: '◈', l: 'Assets' },
        { id: 'risk_calc', i: '⬡', l: 'Risk' },
        { id: 'buyers', i: '●', l: 'Buyers' }
      ];
    }
    return items.slice(0, 4); // Always max 4 items + More
  };

  const navItems = getNavItems();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`bn-item ${view === item.id ? 'on' : ''}`}
          onClick={() => onViewChange(item.id as View)}
        >
          <span className="bn-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {item.id === "admin_onboard" ? (
              <UsersManagementIcon size={20} />
            ) : item.id === "ops_overview" ? (
              <SystemOverviewIcon size={20} />
            ) : item.id === "trs_overview" ? (
              <SystemOverviewIcon size={20} />
            ) : item.id === "admin_verify" ? (
              <RequiredActionIcon size={20} />
            ) : item.id === "pipeline" ? (
              <TradeApplicationIcon size={20} />
            ) : item.id === "portfolio" || item.id === "fp_portfolio" ? (
              <PortfolioIcon size={20} />
            ) : item.id === "trs_apply" ? (
              <PlusIcon size={20} />
            ) : item.id === "trs_status" ? (
              <TradeApplicationIcon size={20} />
            ) : item.id === "buyers" ? (
              <BuyerDatabaseIcon size={20} />
            ) : (
              item.i
            )}
          </span>
          <span>{item.l}</span>
          <div className="bn-dot" />
        </button>
      ))}
      <button className="bn-item" onClick={onOpenMore}>
        <span className="bn-icon">☰</span>
        <span>More</span>
        <div className="bn-dot" style={{ background: '#94A3B8' }} />
      </button>
    </nav>
  );
};

export default BottomNav;
