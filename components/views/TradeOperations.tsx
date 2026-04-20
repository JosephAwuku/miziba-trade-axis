"use client";

import React, { useState } from 'react';
import { Trade } from '@/lib/types';
import { ST as stageConfig, CMD as commodityConfig } from '@/lib/data';
import { usd, mt } from '@/lib/utils';
import { Badge, Button, Card, ProgressBar } from '../ui';
import Pipeline from './Pipeline';

interface TradeOperationsProps {
  trades: Trade[];
  onDealSelect: (id: string) => void;
  role: string;
}

const TradeOperations: React.FC<TradeOperationsProps> = ({ trades, onDealSelect, role }) => {
  const [layout, setLayout] = useState<'list' | 'kanban'>('list');

  const activeDeals = trades.filter((t) => !['SETTLED', 'CLOSED'].includes(t.stage));
  
  // Sorting: Most recent first for list view
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(b.dt || 0).getTime() - new Date(a.dt || 0).getTime()
  );

  const renderEmptyState = () => (
    <div className="fade-in" style={{ padding: '40px 0' }}>
      <div className="card" style={{ 
        padding: '60px', 
        textAlign: 'center', 
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
        border: '2px solid transparent',
        backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--cr)', fontWeight: 700 }}>⬢</div>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
          Operations Queue Clear
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text3)', lineHeight: 1.6, maxWidth: '420px', margin: '0 auto 24px' }}>
          There are currently no active trade applications or deals requiring your attention. You are fully synchronized with the global ledger.
        </p>
        <Button 
            variant="secondary" 
            style={{ padding: '12px 32px', fontSize: '14px', fontWeight: 700 }}
            onClick={() => window.location.reload()}
        >
          Refresh Ledger
        </Button>
      </div>
    </div>
  );

  const renderListView = () => (
    <Card style={{ overflow: 'hidden', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>TRADE REF</th>
              <th>TRADER</th>
              <th>COMMODITY</th>
              <th>VALUE</th>
              <th style={{ width: '150px' }}>CURRENT STAGE</th>
              <th>RISK</th>
              <th style={{ width: '110px' }}>DATE</th>
              <th style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedTrades.map((d) => {
              const cm = commodityConfig[d.cmd];
              const st = stageConfig[d.stage] || { l: d.stage, bg: '#F3F4F6', c: '#374151' };
              
              return (
                <tr key={d.id} className="row-hover">
                  <td>
                    <span className="mono" style={{ fontWeight: 700, color: '#8B0000', fontSize: '12px' }}>
                      {d.id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{d.tr}</div>
                    <div style={{ fontSize: '10px', color: '#6B7280' }}>ID: {d.tid}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>{cm.i}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>{d.cmd}</div>
                        <div style={{ fontSize: '10px', color: '#9CA3AF' }}>Grade {d.gr} · {mt(d.vol)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="mono" style={{ fontWeight: 700, fontSize: '13px' }}>{usd(d.cv)}</div>
                    <div style={{ fontSize: '10px', color: '#6B7280' }}>Facility: {usd(d.ff)}</div>
                  </td>
                  <td>
                    <Badge style={{ 
                      background: `${st.bg}cc`, 
                      color: st.c, 
                      borderColor: st.br,
                      fontWeight: 700,
                      fontSize: '10px',
                      letterSpacing: '0.02em',
                      padding: '4px 8px'
                    }}>
                      {st.l.toUpperCase()}
                    </Badge>
                  </td>
                  <td>
                    {d.risk ? (
                      <Badge variant={d.risk >= 75 ? 'success' : (d.risk >= 55 ? 'warning' : 'danger')} className="mono">
                        {d.risk}/100
                      </Badge>
                    ) : (
                      <Badge variant="default" style={{ opacity: 0.5 }}>Pending</Badge>
                    )}
                  </td>
                  <td style={{ fontSize: '11px', color: '#6B7280' }}>
                    {d.dt ? new Date(d.dt).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onDealSelect(d.id)}
                      style={{ fontWeight: 700, color: 'var(--cr)' }}
                    >
                      OPEN →
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="fade-in">
      {/* Header with Stats & Toggle */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827' }}>
            Trade Operations
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: trades.length > 0 ? '#10B981' : '#9CA3AF' }}></div>
            <p style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
              {activeDeals.length} Active Deals · {trades.length} Total Records
            </p>
          </div>
        </div>

        {trades.length > 0 && (
          <div style={{ 
            display: 'flex', 
            background: '#F3F4F6', 
            padding: '4px', 
            borderRadius: '8px',
            border: '1px solid #E5E7EB'
          }}>
            <button 
              onClick={() => setLayout('list')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: layout === 'list' ? '#fff' : 'transparent',
                color: layout === 'list' ? '#111827' : '#6B7280',
                boxShadow: layout === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              List View
            </button>
            <button 
              onClick={() => setLayout('kanban')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: layout === 'kanban' ? '#fff' : 'transparent',
                color: layout === 'kanban' ? '#111827' : '#6B7280',
                boxShadow: layout === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Kanban
            </button>
          </div>
        )}
      </div>

      {trades.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {layout === 'list' ? renderListView() : <Pipeline trades={trades} onDealSelect={onDealSelect} />}
        </>
      )}

      {/* Footer Utility */}
      {trades.length > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <p style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>
            Displaying all records from local ledger · Synchronized recently
          </p>
        </div>
      )}

      <style jsx>{`
        .row-hover {
          transition: background 0.1s ease-in-out;
        }
        .row-hover:hover {
          background-color: #F9FAFB !important;
        }
        .tbl th {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6B7280;
          font-weight: 700;
          padding: 12px 16px;
          border-bottom: 2px solid #F3F4F6;
        }
        .tbl td {
          padding: 14px 16px;
          vertical-align: middle;
          border-bottom: 1px solid #F3F4F6;
        }
      `}</style>
    </div>
  );
};

export default TradeOperations;
