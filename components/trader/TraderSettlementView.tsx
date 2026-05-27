"use client";

import React, { useState } from 'react';
import { Trade } from '@/lib/types';
import { commodityLabel } from '@/lib/data';
import { Card, Button, Badge } from '../ui';
import Settlement from '../views/Settlement';

interface TraderSettlementViewProps {
  trades: Trade[];
  onNotify: (msg: string, type?: string) => void;
}

const TraderSettlementView: React.FC<TraderSettlementViewProps> = ({ trades, onNotify }) => {
  const settled = trades.filter((t) => ['DELIVERED', 'SETTLED', 'CLOSED'].includes(t.stage));
  const [selectedId, setSelectedId] = useState<string | null>(settled[0]?.id ?? null);

  if (settled.length === 0) {
    return (
      <Card style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }} aria-hidden>💳</div>
        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>No payments to show yet</div>
        <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>
          Payment details from your completed trades appear here. You don&apos;t have any completed trades yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Payments</h2>
        <p style={{ fontSize: '14px', color: 'var(--text2)' }}>
          See payment progress for trades that have been delivered and where the buyer has paid. Pick a trade below for details.
        </p>
      </div>
      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {settled.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: '8px',
                border: selectedId === t.id ? '2px solid #8B0000' : '1px solid #E5E7EB',
                background: selectedId === t.id ? '#FFF5F5' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '13px' }}>
                {commodityLabel(t.cmd)} · {t.vol} MT — <span className="mono">{t.id.slice(0, 8)}</span>
              </span>
              <Badge variant="info">{t.stage.replace(/_/g, ' ')}</Badge>
            </button>
          ))}
        </div>
      </Card>
      {selectedId && (
        <Settlement tradeId={selectedId} onNotify={onNotify} role="trader" />
      )}
    </div>
  );
};

export default TraderSettlementView;
