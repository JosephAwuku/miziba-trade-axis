"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/api-errors';

interface DeliveryConfirmPanelProps {
  tradeId: string;
  stage: string;
  expectedVolumeMt: number;
  canEdit: boolean;
  onNotify: (msg: string, type?: string) => void;
  onSuccess?: () => void;
}

const DeliveryConfirmPanel: React.FC<DeliveryConfirmPanelProps> = ({
  tradeId,
  stage,
  expectedVolumeMt,
  canEdit,
  onNotify,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [weight, setWeight] = useState('');
  const [gradeA, setGradeA] = useState('85');
  const [gradeB, setGradeB] = useState('12');
  const [gradeC, setGradeC] = useState('3');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (stage !== 'PROCURING') return;
    apiClient
      .getDeliveryStatus(tradeId)
      .then((res) => {
        setConfirmed(res.can_advance_to_delivered);
        if (res.delivered_weight_mt > 0) setWeight(String(res.delivered_weight_mt));
      })
      .catch(() => {});
  }, [tradeId, stage]);

  if (stage !== 'PROCURING') return null;

  const handleConfirm = async () => {
    const delivered_weight_mt = parseFloat(weight);
    if (!delivered_weight_mt || delivered_weight_mt <= 0) {
      onNotify('Enter a valid delivered weight (MT)', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient.confirmDelivery(tradeId, {
        delivered_weight_mt,
        grade_a_pct: parseFloat(gradeA) || undefined,
        grade_b_pct: parseFloat(gradeB) || undefined,
        grade_c_pct: parseFloat(gradeC) || undefined,
      });
      setConfirmed(true);
      onNotify(res.message);
      onSuccess?.();
    } catch (err) {
      onNotify(isApiError(err) ? err.message : 'Failed to confirm delivery', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="CONFIRM GOODS DELIVERED" style={{ padding: '16px', marginBottom: '16px' }}>
      {confirmed ? (
        <div className="alert alert-success" style={{ margin: 0 }}>
          Delivery recorded. Use &quot;Mark as Delivered&quot; in the action center to advance the stage.
        </div>
      ) : (
        <>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
            Expected contract volume: <strong>{expectedVolumeMt} MT</strong>
          </p>
          <div className="g2" style={{ gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Delivered weight (MT)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={!canEdit}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Grade A %</label>
              <input
                type="number"
                value={gradeA}
                onChange={(e) => setGradeA(e.target.value)}
                disabled={!canEdit}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Grade B %</label>
              <input
                type="number"
                value={gradeB}
                onChange={(e) => setGradeB(e.target.value)}
                disabled={!canEdit}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Grade C %</label>
              <input
                type="number"
                value={gradeC}
                onChange={(e) => setGradeC(e.target.value)}
                disabled={!canEdit}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
              />
            </div>
          </div>
          {canEdit && (
            <Button variant="primary" disabled={loading} onClick={handleConfirm}>
              Confirm delivery
            </Button>
          )}
        </>
      )}
    </Card>
  );
};

export default DeliveryConfirmPanel;
