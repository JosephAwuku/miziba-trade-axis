"use client";

import React, { useState } from 'react';
import { Trade } from '@/lib/types';
import { ST as stageConfig, CMD as commodityConfig, commodityLabel } from '@/lib/data';
import { usd, mt } from '@/lib/utils';
import { Badge, Button, Card, ProgressBar } from '../ui';
import Pipeline from './Pipeline';
import { TradeApplicationIcon } from '@/components/icons/TradeApplicationIcon';

interface TradeOperationsProps {
  trades: Trade[];
  onDealSelect: (id: string) => void;
  role: string;
}

const TradeOperations: React.FC<TradeOperationsProps> = ({ trades, onDealSelect, role }) => {
  const [layout, setLayout] = useState<'list' | 'kanban'>('list');
  const [localSearch, setLocalSearch] = useState('');

  const filteredTrades = trades.filter(t => 
    t.tid?.toLowerCase().includes(localSearch.toLowerCase()) ||
    t.tr?.toLowerCase().includes(localSearch.toLowerCase()) ||
    t.cmd?.toLowerCase().includes(localSearch.toLowerCase()) ||
    t.id?.toLowerCase().includes(localSearch.toLowerCase())
  );

  const activeDeals = filteredTrades.filter((t) => !['SETTLED', 'CLOSED'].includes(t.stage));
  
  // Sorting: Most recent first for list view
  const sortedTrades = [...filteredTrades].sort((a, b) => 
    new Date(b.dt || 0).getTime() - new Date(a.dt || 0).getTime()
  );
  const truncateId = (value?: string, keep: number = 12) =>
    value ? (value.length > keep ? `${value.slice(0, keep)}...` : value) : '—';

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
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', color: 'var(--cr)' }} aria-hidden>
          <TradeApplicationIcon size={40} />
        </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sortedTrades.map((d) => {
        const cm = commodityConfig[d.cmd];
        const st = stageConfig[d.stage] || { l: d.stage, bg: '#F3F4F6', c: '#374151' };

        return (
          <div
            key={d.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1.3fr 1fr 0.9fr 0.9fr 0.8fr 0.8fr auto',
              gap: '12px',
              alignItems: 'center',
              padding: '16px 18px',
              background: '#fff',
              border: '2px solid transparent',
              backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(15,23,42,0.04)',
            }}
          >
            <span className="mono" style={{ fontWeight: 700, color: '#8B0000', fontSize: '12px' }} title={d.id}>
              {truncateId(d.id)}
            </span>

            <div>
              <div style={{ fontWeight: 600, color: '#111827' }}>{d.tr}</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }} title={d.tid}>ID: {d.tid}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>{cm.i}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{commodityLabel(d.cmd)}</div>
                <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Grade {d.gr} · {mt(d.vol)}</div>
              </div>
            </div>

            <div>
              <div className="mono" style={{ fontWeight: 700, fontSize: '14px' }}>{usd(d.cv)}</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>Facility: {usd(d.ff)}</div>
            </div>

            <Badge style={{
              background: `${st.bg}cc`,
              color: st.c,
              borderColor: st.br,
              fontWeight: 700,
              fontSize: '10px',
              letterSpacing: '0.02em',
              padding: '4px 8px',
              justifySelf: 'start'
            }}>
              {st.l.toUpperCase()}
            </Badge>

            {d.risk ? (
              <Badge variant={d.risk >= 75 ? 'success' : (d.risk >= 55 ? 'warning' : 'danger')} className="mono">
                {d.risk}/100
              </Badge>
            ) : (
              <Badge variant="default" style={{ opacity: 0.5, justifySelf: 'start' }}>Pending</Badge>
            )}

            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              {d.dt ? new Date(d.dt).toLocaleDateString() : '—'}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDealSelect(d.id)}
              style={{ fontWeight: 700, color: 'var(--cr)', justifySelf: 'end' }}
            >
              OPEN →
            </Button>
          </div>
        );
      })}
    </div>
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
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#111827',
              margin: 0,
            }}
          >
            Trade Operations
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: trades.length > 0 ? '#10B981' : '#9CA3AF' }}></div>
            <p style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
              {activeDeals.length} Active Deals · {trades.length} Total Records
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Filter these results..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              style={{ 
                padding: '8px 12px 8px 32px', 
                fontSize: '13px', 
                borderRadius: '8px', 
                border: '1px solid #E5E7EB',
                width: '240px',
                outline: 'none'
              }}
            />
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
      </div>

      {trades.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {layout === 'list' ? renderListView() : <Pipeline trades={filteredTrades} onDealSelect={onDealSelect} />}
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

      <style jsx>{``}</style>
    </div>
  );
};

export default TradeOperations;
