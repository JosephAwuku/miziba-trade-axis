"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, ProgressBar } from '../ui';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/api-errors';

const CLOSURE_ITEMS: { key: string; label: string }[] = [
  { key: 'waterfall_confirmed', label: 'Waterfall settlement confirmed' },
  { key: 'trr_received', label: 'TRR received' },
  { key: 'ccc_received', label: 'CCC received' },
  { key: 'buyer_perf_recorded', label: 'Buyer performance recorded' },
  { key: 'trader_rec_updated', label: 'Trader record updated' },
  { key: 'fp_report_sent', label: 'Finance Partner report sent' },
  { key: 'record_locked', label: 'Lock record (closes trade)' },
];

interface ClosureChecklistPanelProps {
  tradeId: string;
  stage: string;
  canEdit: boolean;
  onNotify: (msg: string, type?: string) => void;
  onSuccess?: () => void;
}

const ClosureChecklistPanel: React.FC<ClosureChecklistPanelProps> = ({
  tradeId,
  stage,
  canEdit,
  onNotify,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState({ completed: 0, total: 7 });

  const load = () => {
    apiClient
      .getClosureChecklist(tradeId)
      .then((res) => {
        setChecklist(res.checklist || {});
        setProgress({ completed: res.completed_items, total: res.total_items });
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (stage === 'SETTLED' || stage === 'CLOSED') load();
  }, [tradeId, stage]);

  if (stage !== 'SETTLED' && stage !== 'CLOSED') return null;

  const toggle = async (key: string, value: boolean) => {
    if (!canEdit) return;
    try {
      setLoading(true);
      const res = await apiClient.updateClosureChecklist(tradeId, { [key]: value });
      setChecklist((prev) => ({ ...prev, [key]: value }));
      setProgress({ completed: res.completed_items, total: res.total_items });
      onNotify(res.message);
      if (key === 'record_locked' && value && res.can_close) {
        onSuccess?.();
      }
    } catch (err) {
      onNotify(isApiError(err) ? err.message : 'Failed to update checklist', 'error');
    } finally {
      setLoading(false);
    }
  };

  const pct = progress.total ? (progress.completed / progress.total) * 100 : 0;

  return (
    <Card title="CLOSURE CHECKLIST" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
          <span style={{ fontWeight: 600 }}>Progress</span>
          <span className="mono">
            {progress.completed}/{progress.total}
          </span>
        </div>
        <ProgressBar value={pct} color="#8B0000" height="8px" />
      </div>
      {CLOSURE_ITEMS.map((item) => (
        <div
          key={item.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 0',
            borderBottom: '1px solid #F3F4F6',
          }}
        >
          <div
            className={`chk-box ${checklist[item.key] ? 'on' : ''}`}
            onClick={() => !loading && toggle(item.key, !checklist[item.key])}
            style={{ cursor: canEdit ? 'pointer' : 'default' }}
          >
            {checklist[item.key] && (
              <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>
            )}
          </div>
          <span style={{ fontSize: '13px', fontWeight: item.key === 'record_locked' ? 700 : 500 }}>
            {item.label}
          </span>
        </div>
      ))}
      {stage === 'CLOSED' && (
        <div className="alert alert-success" style={{ marginTop: '12px', marginBottom: 0 }}>
          Trade closed and locked.
        </div>
      )}
    </Card>
  );
};

export default ClosureChecklistPanel;
