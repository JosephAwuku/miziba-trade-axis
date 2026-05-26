"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/api-errors';

interface CeoDecisionPanelProps {
  tradeId: string;
  stage: string;
  riskScore: number;
  role: string;
  onNotify: (msg: string, type?: string) => void;
  onSuccess?: () => void;
}

const CeoDecisionPanel: React.FC<CeoDecisionPanelProps> = ({
  tradeId,
  stage,
  riskScore,
  role,
  onNotify,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<string | null>(null);

  const needsCeo = riskScore > 0 && riskScore < 55;

  useEffect(() => {
    if (!needsCeo || stage !== 'VALIDATED') return;
    apiClient
      .getCeoEscalation(tradeId)
      .then((res) => setDecision(res.escalation?.decision ?? null))
      .catch(() => {});
  }, [tradeId, stage, needsCeo]);

  if (role !== 'ceo' || !needsCeo || stage !== 'VALIDATED') return null;

  const submit = async (d: 'approve_direct' | 'require_validation' | 'decline') => {
    try {
      setLoading(true);
      const res = await apiClient.submitCeoDecision(tradeId, {
        decision: d,
        notes: notes.trim() || undefined,
      });
      setDecision(d);
      onNotify(res.message);
      onSuccess?.();
    } catch (err) {
      onNotify(isApiError(err) ? err.message : 'Failed to record CEO decision', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (decision === 'approve_direct') {
    return (
      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <div className="alert alert-success" style={{ margin: 0 }}>
          CEO approved this high-risk trade. You may generate the FDP and send to Finance Review.
        </div>
      </Card>
    );
  }

  if (decision === 'decline') {
    return (
      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <div className="alert alert-danger" style={{ margin: 0 }}>
          CEO declined this trade. It cannot proceed to Finance Review.
        </div>
      </Card>
    );
  }

  return (
    <Card title="CEO ESCALATION — HIGH RISK" style={{ padding: '16px', marginBottom: '16px', border: '1px solid #FECACA' }}>
      <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
        Risk score {riskScore}/100 is below the 55 threshold. CEO approval is required before Finance Review.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{
          width: '100%',
          minHeight: '64px',
          padding: '8px',
          borderRadius: '6px',
          border: '1px solid #D1D5DB',
          fontSize: '12px',
          marginBottom: '12px',
        }}
        placeholder="Decision notes"
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <Button variant="primary" disabled={loading} onClick={() => submit('approve_direct')}>
          Approve for Finance Review
        </Button>
        <Button variant="secondary" disabled={loading} onClick={() => submit('require_validation')}>
          Require more validation
        </Button>
        <Button variant="ghost" disabled={loading} onClick={() => submit('decline')} style={{ color: '#DC2626' }}>
          Decline trade
        </Button>
      </div>
    </Card>
  );
};

export default CeoDecisionPanel;
