"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge } from '../ui';
import { apiClient } from '@/lib/api';

interface AuditLogViewerProps {
  onNotify: (msg: string, type?: string) => void;
  onBack?: () => void;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ onNotify, onBack }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 25;
  const [action, setAction] = useState('');
  const [tradeId, setTradeId] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAuditLogs({
        page,
        per_page: perPage,
        action: action || undefined,
        trade_id: tradeId || undefined,
        search: search || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setEntries(res.data);
      setTotal(res.total);
    } catch {
      onNotify('Failed to load audit log', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, action, tradeId, search, fromDate, toDate, onNotify]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportCsv = () => {
    if (!entries.length) {
      onNotify('No rows to export on this page', 'error');
      return;
    }
    const headers = ['Time', 'User', 'Role', 'Action', 'Entity', 'Trade', 'Trade ID'];
    const rows = entries.map((e) => [
      new Date(e.occurred_at).toISOString(),
      e.user_name,
      e.user_role || '',
      e.action,
      e.entity_type,
      e.trade_ref || '',
      e.trade_id || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradeaxis-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Audit log exported');
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Audit Log</h2>
          <p style={{ fontSize: '14px', color: 'var(--text2)', marginTop: '4px' }}>
            Immutable record of system actions ({total} entries)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {onBack && (
            <Button variant="secondary" onClick={onBack}>
              ← Back
            </Button>
          )}
          <Button variant="secondary" onClick={exportCsv}>
            Export page CSV
          </Button>
        </div>
      </div>

      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <div className="g2" style={{ gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Search action / entity</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. STAGE_CHANGE"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Action filter</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Partial match"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Trade ID</label>
            <input
              value={tradeId}
              onChange={(e) => setTradeId(e.target.value)}
              placeholder="UUID"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }} />
          </div>
          <Button variant="primary" onClick={() => { setPage(1); fetchLogs(); }}>
            Apply filters
          </Button>
        </div>
      </Card>

      <Card style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>Loading audit entries…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>No audit entries match your filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Time', 'User', 'Action', 'Entity', 'Trade', 'Details'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#6B7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }} className="mono">
                      {new Date(e.occurred_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{e.user_name}</div>
                      <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{e.user_role}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge variant="default">{e.action.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6B7280' }}>{e.entity_type}</td>
                    <td style={{ padding: '10px 12px' }} className="mono">
                      {e.trade_ref || (e.trade_id ? e.trade_id.slice(0, 8) : '—')}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: '220px', color: '#6B7280', fontSize: '11px' }}>
                      {e.new_value?.stage
                        ? `→ ${e.new_value.stage}`
                        : e.new_value?.risk != null
                          ? `Risk: ${e.new_value.risk}`
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AuditLogViewer;
