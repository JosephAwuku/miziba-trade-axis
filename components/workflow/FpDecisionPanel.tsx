"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/api-errors';

interface FpDecisionPanelProps {
  tradeId: string;
  stage: string;
  onNotify: (msg: string, type?: string) => void;
  onSuccess?: () => void;
}

const FpDecisionPanel: React.FC<FpDecisionPanelProps> = ({
  tradeId,
  stage,
  onNotify,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [latestDecision, setLatestDecision] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== 'FINANCE_REVIEW') return;
    apiClient
      .getFpDecisions(tradeId)
      .then((res) => {
        const d = res.decisions?.[0];
        if (d) setLatestDecision(d.decision);
      })
      .catch(() => {});
  }, [tradeId, stage]);

  if (stage !== 'FINANCE_REVIEW') return null;

  const submit = async (decision: 'approve' | 'decline' | 'info_request') => {
    try {
      setLoading(true);
      const res = await apiClient.submitFpDecision(tradeId, {
        decision,
        notes: notes.trim() || undefined,
        info_request: decision === 'info_request' ? notes.trim() : undefined,
      });
      setLatestDecision(decision);
      onNotify(res.message);
      onSuccess?.();
    } catch (err) {
      onNotify(isApiError(err) ? err.message : 'Failed to submit decision', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (latestDecision === 'approve') {
    return (
      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <div className="alert alert-success" style={{ margin: 0 }}>
          Facility approved. Trade is now in FUNDED stage.
        </div>
      </Card>
    );
  }

  if (latestDecision === 'decline') {
    return (
      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <div className="alert alert-danger" style={{ margin: 0 }}>
          Facility declined. Deal Officer and trader have been notified.
        </div>
      </Card>
    );
  }

  return (
    <Card title="FINANCE PARTNER DECISION" style={{ padding: '16px', marginBottom: '16px' }}>
      <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
        Approve to fund this facility, decline to reject, or request more information.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{
          width: '100%',
          minHeight: '72px',
          padding: '8px',
          borderRadius: '6px',
          border: '1px solid #D1D5DB',
          fontSize: '12px',
          marginBottom: '14px',
        }}
        placeholder="Notes (required for info request)"
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <Button
          variant="primary"
          disabled={loading}
          onClick={() => submit('approve')}
          style={{ background: '#8B0000', border: 'none' }}
        >
          Approve facility
        </Button>
        <Button variant="secondary" disabled={loading} onClick={() => submit('decline')}>
          Decline
        </Button>
        <Button variant="ghost" disabled={loading || !notes.trim()} onClick={() => submit('info_request')}>
          Request info
        </Button>
      </div>
    </Card>
  );
};

export default FpDecisionPanel;
