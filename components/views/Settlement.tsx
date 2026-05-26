"use client";

import React, { useState, useEffect } from 'react';
import { Card, ProgressBar, Badge, Button, CustomDatePicker } from '../ui';
import { usd } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/api-errors';

interface SettlementProps {
  tradeId: string;
  onNotify: (msg: string, type?: string) => void;
  role: string;
  onSettlementChange?: () => void;
}

const Settlement: React.FC<SettlementProps> = ({ tradeId, onNotify, role, onSettlementChange }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchSettlement();
  }, [tradeId]);

  const fetchSettlement = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getSettlementData(tradeId);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch settlement', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'initiate' | 'record_payment' | 'sign', payload?: Record<string, unknown>) => {
    try {
      setLoading(true);
      const res = await apiClient.updateSettlement(tradeId, { action, ...payload } as Parameters<typeof apiClient.updateSettlement>[1]);
      if (res.advanced_to_settled) {
        onNotify('Settlement signed — trade advanced to SETTLED');
      } else {
        onNotify(`Settlement ${action.replace('_', ' ')} recorded`);
      }
      fetchSettlement();
      onSettlementChange?.();
    } catch (err) {
      onNotify(isApiError(err) ? err.message : `Failed to ${action} settlement`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const canManage = ['cfo', 'ceo'].includes(role);

  if (loading && !data) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading settlement data...</div>;
  }

  if (data?.status === 'not_started') {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚖️</div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>Settlement Not Initiated</h3>
        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px', maxWidth: '400px', marginInline: 'auto' }}>
          This trade has not yet entered the settlement phase. Settlements are typically initiated once the buyer payment is confirmed.
        </p>
        {canManage && (
          <Button variant="primary" onClick={() => handleAction('initiate')}>
            Initiate Settlement Waterfall
          </Button>
        )}
      </div>
    );
  }

  const { settlement, progress, waterfall_instructions } = data;

  return (
    <div className="fade-in">
      <div className="g2" style={{ alignItems: 'start', gap: '20px', marginBottom: '20px' }}>
        <div>
          <Card title="SETTLEMENT PROGRESS" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Total Collected</span>
              <span className="mono" style={{ fontWeight: 700, color: progress.percentage === 100 ? '#8B0000' : '#8B0000' }}>
                {usd(progress.amount_paid)} / {usd(progress.total_amount)}
              </span>
            </div>
            <ProgressBar value={progress.percentage} color={progress.percentage === 100 ? '#8B0000' : '#8B0000'} height="12px" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#6B7280' }}>
              <span>{progress.percentage}% Complete</span>
              <span>{usd(progress.remaining)} Remaining</span>
            </div>
          </Card>

          <Card title="WATERFALL INSTRUCTIONS">
            <div style={{ padding: '16px' }}>
              {(waterfall_instructions || []).map((step: any, i: number) => (
                <div key={i} style={{ display: 'flex', padding: '12px 0', borderBottom: i < waterfall_instructions.length - 1 ? '1px solid #F3F4F6' : 'none', gap: '12px' }}>
                   <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>{i + 1}</div>
                   <div style={{ flex: 1 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>
                       <span>{step.label || step.type.replace('_', ' ').toUpperCase()}</span>
                       <span className="mono">{usd(step.amount)}</span>
                     </div>
                     <div style={{ fontSize: '11px', color: '#6B7280' }}>Priority: {step.priority || (i + 1)} · {step.entity || 'Beneficiary'}</div>
                   </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          {canManage && progress.percentage < 100 && (
            <Card title="RECORD RECOVERY" style={{ padding: '16px', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>AMOUNT RECEIVED (USD)</label>
                <input 
                  type="number" 
                  className="ui-input" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                  placeholder="0.00"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>DATE RECEIVED</label>
                <CustomDatePicker 
                  value={paymentDate} 
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <Button 
                variant="primary" 
                style={{ width: '100%' }} 
                onClick={() => handleAction('record_payment', { payment_amount: parseFloat(paymentAmount), payment_date: paymentDate })}
                disabled={!paymentAmount || loading}
              >
                Confirm Payment Receipt
              </Button>
            </Card>
          )}

          <Card title="DIGITAL SIGNATORIES" style={{ padding: '16px', marginBottom: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', marginBottom: '10px' }}>REQUIRED SIGNATURES (2)</div>
              {data.signatures && data.signatures.length > 0 ? (
                data.signatures.map((sig: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '8px', background: '#FFF5F5', borderRadius: '6px', border: '1px solid #FECACA' }}>
                    <div style={{ fontSize: '16px' }}>✍️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#8B0000' }}>{sig.users?.full_name || 'Authorized Signatory'}</div>
                      <div style={{ fontSize: '10px', color: '#8B0000' }}>{sig.users?.role?.toUpperCase()} · {new Date(sig.signed_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed #D1D5DB', borderRadius: '6px', color: '#9CA3AF', fontSize: '12px' }}>
                  Awaiting CFO/CEO signatures
                </div>
              )}
            </div>

            {canManage && ['cfo', 'ceo'].includes(role) && !data.signatures?.some((s: any) => s.users?.role === role) && (
              <Button 
                variant="navy" 
                style={{ width: '100%' }} 
                onClick={() => handleAction('sign')}
              >
                Digitally Sign for Finalization
              </Button>
            )}
          </Card>

          <Card title="SETTLEMENT AUDIT" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', color: '#6B7280' }}>
               Initiated by: {settlement.initiated_by_name || 'System'}
               <br/>
               Initiated at: {new Date(settlement.initiated_at).toLocaleString()}
               <hr style={{ margin: '10px 0', borderColor: '#F3F4F6' }} />
               {progress.percentage === 100 && data.signatures?.length >= 2 ? (
                 <div style={{ color: '#8B0000', fontWeight: 600 }}>✓ Settlement fully finalized & signed</div>
               ) : (
                 <div>
                   Status: {progress.status.replace('_', ' ').toUpperCase()} 
                   ({data.signatures?.length || 0}/2 Signatures)
                 </div>
               )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settlement;
