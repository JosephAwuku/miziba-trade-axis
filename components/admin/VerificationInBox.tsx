"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Badge } from '../ui';
import { apiClient } from '@/lib/api';

interface VerificationInBoxProps {
  onNotify: (msg: string, type?: string) => void;
  targetOrgId?: string;
  onBack?: () => void;
}

function traderRowProfile(t: any) {
  return t?.traderProfile || t?.trader_profiles?.[0] || {};
}

function listContactEmail(t: any) {
  const u = t?.users;
  if (Array.isArray(u) && u.length > 0) return u[0]?.email || '';
  return '';
}

const VerificationInBox: React.FC<VerificationInBoxProps> = ({ onNotify, targetOrgId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [traders, setTraders] = useState<any[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPendingTraders();
      setTraders(data);
    } catch (err: any) {
      onNotify(err.message || 'Failed to fetch pending traders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (!targetOrgId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await apiClient.getTraderProfileForAdmin(targetOrgId);
        if (cancelled) return;
        setTraders(prev => (prev.some(t => t.id === detail.id) ? prev : [detail, ...prev]));
        setSelectedTrader(detail);
      } catch (e: any) {
        if (!cancelled) onNotify(e.message || 'Failed to load trader organisation.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetOrgId, onNotify]);

  useEffect(() => {
    if (targetOrgId && traders.length > 0) {
      const match = traders.find(t => t.id === targetOrgId);
      if (match) setSelectedTrader(match);
    }
  }, [targetOrgId, traders]);

  const handleDecision = async (decision: 'VERIFIED' | 'REJECTED') => {
    if (!selectedTrader) return;
    if (decision === 'REJECTED' && !rejectNotes.trim()) {
      onNotify('Please add a short note for the trader before rejecting.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.verifyTrader(selectedTrader.id, decision, decision === 'REJECTED' ? rejectNotes.trim() : undefined);
      onNotify(`Trader ${decision === 'VERIFIED' ? 'verified' : 'disqualified'} successfully.`, 'success');
      setSelectedTrader(null);
      setRejectNotes('');
      fetchPending();
    } catch (err: any) {
      onNotify(err.message || 'Action failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openDocument = async (docId: string) => {
    if (!selectedTrader?.id) return;
    setDownloadingId(docId);
    try {
      const { url } = await apiClient.getTraderKycDocumentSignedUrl(selectedTrader.id, docId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      onNotify(e.message || 'Could not open document.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <div className="animate-pulse" style={{ padding: '20px', color: '#6B7280' }}>Scanning for pending verifications...</div>;
  }

  const tp = selectedTrader ? traderRowProfile(selectedTrader) : null;
  const docs: any[] = Array.isArray(selectedTrader?.organisation_documents) ? selectedTrader.organisation_documents : [];

  return (
    <div className="fade-in">
      {onBack && (
        <div style={{ marginBottom: '16px' }}>
          <div
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--cr)', fontSize: '13px', fontWeight: 800, transition: 'transform 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(-4px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            BACK TO PREVIOUS PAGE
          </div>
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Required Action</h2>
      </div>

      <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 350px) 1fr', gap: '20px', alignItems: 'start' }}>
        <Card title={`QUEUE (${traders.length})`}>
          {traders.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: '14px', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: '#374151', marginBottom: '8px' }}>You have no pending actions</div>
              <div style={{ fontSize: '13px' }}>
                No trader company verifications are waiting for review right now.
              </div>
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
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setSelectedTrader(t)}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{t.name}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>{listContactEmail(t) || '—'}</div>
                  <div style={{ marginTop: '8px' }}>
                    <Badge variant="warning">{t.kyc_status === 'UNDER_REVIEW' ? 'UNDER REVIEW' : t.kyc_status || 'PENDING'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {selectedTrader ? (
          <Card key={selectedTrader.id} className="fade-in">
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{selectedTrader.name}</h3>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    Org ID: {selectedTrader.id.slice(0, 8).toUpperCase()}… · Primary contact: {listContactEmail(selectedTrader) || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Button variant="primary" onClick={() => handleDecision('VERIFIED')} disabled={submitting}>
                    {submitting ? '…' : 'Verify Trader'}
                  </Button>
                  <Button variant="secondary" onClick={() => handleDecision('REJECTED')} disabled={submitting}>
                    {submitting ? '…' : 'Disqualify'}
                  </Button>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '6px' }}>DISQUALIFICATION NOTE (TRADER WILL SEE THIS)</label>
                <textarea
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  placeholder="Required if disqualifying — e.g. need clearer bank statement, expired TIN certificate…"
                  rows={3}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <section>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '12px', letterSpacing: '0.05em' }}>BUSINESS DETAILS</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      ['Registration No', selectedTrader.registration_no],
                      ['TIN Number', selectedTrader.tin],
                      ['Country', selectedTrader.country],
                      ['Address', selectedTrader.address],
                    ].map(([l, v]) => (
                      <div key={String(l)}>
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
                      ['Bank Name', tp?.bank_name],
                      ['Account No', tp?.bank_account_number],
                      ['Branch', tp?.bank_account_branch],
                      ['SWIFT Code', tp?.bank_swift],
                      ['Account Holder', tp?.bank_account_name],
                    ].map(([l, v]) => (
                      <div key={String(l)}>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>{l}</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{v || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '12px', letterSpacing: '0.05em' }}>COMPANY KYC DOCUMENTS (ONE-TIME)</h4>
                {docs.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>No files recorded in organisation_documents yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {docs.map((d: any) => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '12px 14px',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700 }}>{d.doc_type}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{d.name}</div>
                          <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>Status: {d.status || 'UPLOADED'}</div>
                        </div>
                        <Button variant="secondary" size="sm" disabled={downloadingId === d.id} onClick={() => openDocument(d.id)}>
                          {downloadingId === d.id ? '…' : 'Open'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', border: '2px dashed #E5E7EB', borderRadius: '12px', color: '#64748B', fontSize: '14px', padding: '24px', textAlign: 'center', lineHeight: 1.5 }}>
            {traders.length === 0 ? (
              <div>
                <div style={{ fontWeight: 700, color: '#374151', marginBottom: '8px' }}>Nothing to review yet</div>
                <div style={{ fontSize: '13px' }}>When a trader submits company verification, select them from the queue on the left.</div>
              </div>
            ) : (
              'Select a trader from the list to review their details and download KYC files.'
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationInBox;
