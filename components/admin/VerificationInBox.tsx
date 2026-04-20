"use client";

import React, { useState, useEffect } from 'react';
import { Button, Card, Badge } from '../ui';
import { apiClient } from '@/lib/api';

interface VerificationInBoxProps {
  onNotify: (msg: string, type?: string) => void;
  targetTraderId?: string;
}

const VerificationInBox: React.FC<VerificationInBoxProps> = ({ onNotify, targetTraderId }) => {
  const [loading, setLoading] = useState(true);
  const [traders, setTraders] = useState<any[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      await fetchPending();
    };
    init();
  }, []);

  useEffect(() => {
    if (targetTraderId && traders.length > 0) {
      const match = traders.find(t => t.id === targetTraderId);
      if (match) setSelectedTrader(match);
    }
  }, [targetTraderId, traders]);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPendingTraders();
      setTraders(data);
    } catch (err: any) {
      onNotify(err.message || 'Failed to fetch pending traders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision: 'VERIFIED' | 'REJECTED') => {
    if (!selectedTrader) return;
    
    setSubmitting(true);
    try {
      await apiClient.verifyTrader(selectedTrader.id, decision);
      onNotify(`Trader ${decision === 'VERIFIED' ? 'approved' : 'rejected'} successfully.`, 'success');
      setSelectedTrader(null);
      fetchPending();
    } catch (err: any) {
      onNotify(err.message || 'Action failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse" style={{ padding: '20px', color: '#6B7280' }}>Scanning for pending verifications...</div>;
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Verification Inbox</h2>
        <p style={{ fontSize: '12px', color: '#6B7280' }}>Review and approve business credentials for new traders.</p>
      </div>

      <div className="g2" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* List */}
        <Card title={`PENDING (${traders.length})`}>
          {traders.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
              No traders awaiting review.
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {traders.map(t => (
                <div 
                  key={t.id} 
                  className={`list-item ${selectedTrader?.id === t.id ? 'active' : ''}`}
                  style={{ 
                    padding: '16px', 
                    borderBottom: '1px solid #F3F4F6', 
                    cursor: 'pointer',
                    background: selectedTrader?.id === t.id ? '#F8FAFC' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setSelectedTrader(t)}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{t.name}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>{t.email || 'No email provided'}</div>
                  <div style={{ marginTop: '8px' }}>
                     <Badge variant="warning">UNDER REVIEW</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Detail */}
        {selectedTrader ? (
          <Card key={selectedTrader.id} className="fade-in">
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{selectedTrader.name}</h3>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>KYC Application Ref: {selectedTrader.id.slice(0,8).toUpperCase()}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button 
                    variant="primary" 
                    onClick={() => handleDecision('VERIFIED')}
                    disabled={submitting}
                  >
                    {submitting ? '...' : 'Approve & Verify'}
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => handleDecision('REJECTED')}
                    disabled={submitting}
                  >
                    Reject
                  </Button>
                </div>
              </div>

              <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <section>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '12px', letterSpacing: '0.05em' }}>BUSINESS DETAILS</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      ['Registration No', selectedTrader.registration_no],
                      ['TIN Number', selectedTrader.tin],
                      ['Country', selectedTrader.country],
                      ['Address', selectedTrader.address]
                    ].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>{l}</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{v || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '12px', letterSpacing: '0.05em' }}>SETTLEMENT BANKING</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      ['Bank Name', selectedTrader.trader_profiles?.[0]?.bank_name],
                      ['Account No', selectedTrader.trader_profiles?.[0]?.bank_account_number],
                      ['SWIFT Code', selectedTrader.trader_profiles?.[0]?.bank_swift],
                      ['Account Holder', selectedTrader.trader_profiles?.[0]?.bank_account_name]
                    ].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>{l}</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{v || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '12px', letterSpacing: '0.05em' }}>SUBMITTED DOCUMENTS</h4>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['Incorporation.pdf', 'TIN_Cert.pdf', 'Export_Licence.pdf'].map(doc => (
                    <div key={doc} style={{ padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <span>📄</span> {doc}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', border: '2px dashed #E5E7EB', borderRadius: '12px', color: '#9CA3AF', fontSize: '14px' }}>
            Select a trader from the list to review their details
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationInBox;
