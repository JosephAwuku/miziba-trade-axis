"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Badge } from '../ui';
import { apiClient } from '@/lib/api';

interface VerificationInBoxProps {
  onNotify: (msg: string, type?: string) => void;
  targetOrgId?: string;
  onBack?: () => void;
}

interface VerificationStatus {
  isFullyVerified: boolean;
  kyc_status: string;
  companyProfile: {
    isVerified: boolean;
    hasData: boolean;
    verifiedBy: string | null;
    verifiedAt: string | null;
    rejectionNotes: string | null;
  };
  bankDetails: {
    isVerified: boolean;
    hasData: boolean;
    verifiedBy: string | null;
    verifiedAt: string | null;
    rejectionNotes: string | null;
  };
  documents: Array<{
    id: string;
    docType: string;
    name: string;
    status: string;
    rejectionNotes: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
  }>;
  requiredDocuments: {
    total: number;
    uploaded: number;
    verified: number;
    rejected: number;
    missing: string[];
  };
}

function traderRowProfile(t: any) {
  return t?.traderProfile || t?.trader_profiles?.[0] || {};
}

function listContactEmail(t: any) {
  const u = t?.users;
  if (Array.isArray(u) && u.length > 0) return u[0]?.email || '';
  return '';
}

function VerificationItemBadge({ status }: { status: string }) {
  if (status === 'VERIFIED' || status === 'verified') {
    return <Badge variant="success">VERIFIED</Badge>;
  }
  if (status === 'REJECTED' || status === 'rejected') {
    return <Badge variant="danger">REJECTED</Badge>;
  }
  if (status === 'UNDER_REVIEW') {
    return <Badge variant="warning">UNDER REVIEW</Badge>;
  }
  return <Badge variant="default">PENDING</Badge>;
}

const VerificationInBox: React.FC<VerificationInBoxProps> = ({ onNotify, targetOrgId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [traders, setTraders] = useState<any[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    company: true,
    bank: true,
    docs: true,
  });
  const [sendingReminders, setSendingReminders] = useState(false);

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

  const fetchVerificationStatus = useCallback(async (orgId: string) => {
    try {
      const status = await apiClient.getTraderVerificationStatus(orgId);
      setVerificationStatus(status);
    } catch (err: any) {
      onNotify(err.message || 'Failed to fetch verification status.', 'error');
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
        await fetchVerificationStatus(targetOrgId);
      } catch (e: any) {
        if (!cancelled) onNotify(e.message || 'Failed to load trader organisation.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetOrgId, onNotify, fetchVerificationStatus]);

  useEffect(() => {
    if (targetOrgId && traders.length > 0) {
      const match = traders.find(t => t.id === targetOrgId);
      if (match) {
        setSelectedTrader(match);
        fetchVerificationStatus(targetOrgId);
      }
    }
  }, [targetOrgId, traders, fetchVerificationStatus]);

  useEffect(() => {
    if (selectedTrader?.id) {
      fetchVerificationStatus(selectedTrader.id);
    }
  }, [selectedTrader, fetchVerificationStatus]);

  const handleVerifyItem = async (
    target: 'document' | 'company_profile' | 'bank_details' | 'full_verification',
    decision: 'approve' | 'reject',
    documentId?: string
  ) => {
    if (!selectedTrader) return;
    
    const noteKey = documentId || target;
    if (decision === 'reject' && !notes[noteKey]?.trim()) {
      onNotify('Please add notes when rejecting an item.', 'error');
      return;
    }

    setSubmitting(noteKey);
    try {
      const result = await apiClient.verifyKycItem({
        org_id: selectedTrader.id,
        target,
        decision,
        notes: notes[noteKey]?.trim(),
        document_id: documentId,
      });
      
      onNotify(result.message, 'success');
      
      // Clear the note for this item
      setNotes(prev => ({ ...prev, [noteKey]: '' }));
      
      // Refresh verification status
      await fetchVerificationStatus(selectedTrader.id);
      
      // If fully verified or rejected, refresh the pending list
      if (result.isFullyVerified || result.kycStatus === 'REJECTED') {
        await fetchPending();
      }
    } catch (err: any) {
      onNotify(err.message || 'Action failed.', 'error');
    } finally {
      setSubmitting(null);
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const result = await apiClient.sendKycReminders(3);
      onNotify(result.message, 'success');
    } catch (err: any) {
      onNotify(err.message || 'Failed to send reminders.', 'error');
    } finally {
      setSendingReminders(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse" style={{ padding: '20px', color: '#6B7280' }}>Scanning for pending verifications...</div>;
  }

  const tp = selectedTrader ? traderRowProfile(selectedTrader) : null;

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
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Required Action · Granular Verification</h2>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0 0' }}>
            Review and approve/reject individual items. Trader becomes VERIFIED only when ALL items are approved.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSendReminders}
          disabled={sendingReminders}
          style={{ fontWeight: 700, fontSize: '12px', border: '1.5px solid var(--bdr)', color: 'var(--text2)', flexShrink: 0 }}
        >
          {sendingReminders ? 'Sending…' : '📣 Send Reminders to Pending Traders'}
        </Button>
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

        {selectedTrader && verificationStatus ? (
          <Card key={selectedTrader.id} className="fade-in">
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{selectedTrader.name}</h3>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
                  Org ID: {selectedTrader.id.slice(0, 8).toUpperCase()}… · Contact: {listContactEmail(selectedTrader) || '—'}
                </div>
                <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
                  <VerificationItemBadge status={verificationStatus.kyc_status} />
                  {verificationStatus.isFullyVerified && (
                    <Badge variant="success">✓ FULLY VERIFIED</Badge>
                  )}
                </div>
              </div>

              {/* Company Profile Section */}
              <div style={{ marginBottom: '20px', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                <div
                  onClick={() => toggleSection('company')}
                  style={{
                    padding: '14px 16px',
                    background: '#F9FAFB',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                      COMPANY PROFILE
                    </span>
                    {verificationStatus.companyProfile.isVerified ? (
                      <Badge variant="success">VERIFIED</Badge>
                    ) : verificationStatus.companyProfile.rejectionNotes ? (
                      <Badge variant="danger">REJECTED</Badge>
                    ) : verificationStatus.companyProfile.hasData ? (
                      <Badge variant="warning">PENDING REVIEW</Badge>
                    ) : (
                      <Badge variant="default">NOT SUBMITTED</Badge>
                    )}
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: expandedSections.company ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {expandedSections.company && (
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      {[
                        ['Registration No', selectedTrader.registration_no],
                        ['TIN Number', selectedTrader.tin],
                        ['Country', selectedTrader.country],
                        ['Address', selectedTrader.address],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>{label}</div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: value ? '#111827' : '#9CA3AF' }}>
                            {value || 'Not provided'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {verificationStatus.companyProfile.rejectionNotes && (
                      <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', marginBottom: '4px' }}>
                          REJECTION REASON
                        </div>
                        <div style={{ fontSize: '12px', color: '#7F1D1D' }}>
                          {verificationStatus.companyProfile.rejectionNotes}
                        </div>
                      </div>
                    )}
                    {!verificationStatus.companyProfile.isVerified && verificationStatus.companyProfile.hasData && (
                      <div>
                        <textarea
                          placeholder="Optional: Add notes for trader (required if rejecting)"
                          value={notes['company_profile'] || ''}
                          onChange={(e) => setNotes(prev => ({ ...prev, company_profile: e.target.value }))}
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #E5E7EB',
                            fontSize: '12px',
                            marginBottom: '10px',
                            resize: 'vertical',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleVerifyItem('company_profile', 'approve')}
                            disabled={submitting === 'company_profile'}
                          >
                            {submitting === 'company_profile' ? '...' : 'Approve Profile'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleVerifyItem('company_profile', 'reject')}
                            disabled={submitting === 'company_profile'}
                          >
                            {submitting === 'company_profile' ? '...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bank Details Section */}
              <div style={{ marginBottom: '20px', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                <div
                  onClick={() => toggleSection('bank')}
                  style={{
                    padding: '14px 16px',
                    background: '#F9FAFB',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                      BANK DETAILS
                    </span>
                    {verificationStatus.bankDetails.isVerified ? (
                      <Badge variant="success">VERIFIED</Badge>
                    ) : verificationStatus.bankDetails.rejectionNotes ? (
                      <Badge variant="danger">REJECTED</Badge>
                    ) : verificationStatus.bankDetails.hasData ? (
                      <Badge variant="warning">PENDING REVIEW</Badge>
                    ) : (
                      <Badge variant="default">NOT SUBMITTED</Badge>
                    )}
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: expandedSections.bank ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {expandedSections.bank && (
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      {[
                        ['Bank Name', tp?.bank_name],
                        ['Account No', tp?.bank_account_number],
                        ['Branch', tp?.bank_account_branch],
                        ['SWIFT Code', tp?.bank_swift],
                        ['Account Holder', tp?.bank_account_name],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>{label}</div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: value ? '#111827' : '#9CA3AF' }}>
                            {value || 'Not provided'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {verificationStatus.bankDetails.rejectionNotes && (
                      <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', marginBottom: '4px' }}>
                          REJECTION REASON
                        </div>
                        <div style={{ fontSize: '12px', color: '#7F1D1D' }}>
                          {verificationStatus.bankDetails.rejectionNotes}
                        </div>
                      </div>
                    )}
                    {!verificationStatus.bankDetails.isVerified && verificationStatus.bankDetails.hasData && (
                      <div>
                        <textarea
                          placeholder="Optional: Add notes for trader (required if rejecting)"
                          value={notes['bank_details'] || ''}
                          onChange={(e) => setNotes(prev => ({ ...prev, bank_details: e.target.value }))}
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #E5E7EB',
                            fontSize: '12px',
                            marginBottom: '10px',
                            resize: 'vertical',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleVerifyItem('bank_details', 'approve')}
                            disabled={submitting === 'bank_details'}
                          >
                            {submitting === 'bank_details' ? '...' : 'Approve Bank Details'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleVerifyItem('bank_details', 'reject')}
                            disabled={submitting === 'bank_details'}
                          >
                            {submitting === 'bank_details' ? '...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Documents Section */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                <div
                  onClick={() => toggleSection('docs')}
                  style={{
                    padding: '14px 16px',
                    background: '#F9FAFB',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                      DOCUMENTS ({verificationStatus.documents.length})
                    </span>
                    <Badge variant={verificationStatus.requiredDocuments.verified === verificationStatus.requiredDocuments.total ? 'success' : 'warning'}>
                      {verificationStatus.requiredDocuments.verified}/{verificationStatus.requiredDocuments.total} VERIFIED
                    </Badge>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: expandedSections.docs ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {expandedSections.docs && (
                  <div style={{ padding: '16px' }}>
                    {verificationStatus.requiredDocuments.missing.length > 0 && (
                      <div style={{ padding: '12px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '6px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', marginBottom: '4px' }}>
                          MISSING REQUIRED DOCUMENTS
                        </div>
                        <ul style={{ fontSize: '12px', color: '#78350F', margin: '4px 0', paddingLeft: '20px' }}>
                          {verificationStatus.requiredDocuments.missing.map(doc => (
                            <li key={doc}>{doc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {verificationStatus.documents.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', padding: '20px' }}>
                        No documents uploaded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {verificationStatus.documents.map((doc) => (
                          <div
                            key={doc.id}
                            style={{
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              padding: '14px',
                              background: '#FAFAFA',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{doc.docType}</div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>{doc.name}</div>
                              </div>
                              <VerificationItemBadge status={doc.status} />
                            </div>
                            {doc.rejectionNotes && (
                              <div style={{ padding: '10px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', marginBottom: '10px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#991B1B', marginBottom: '3px' }}>
                                  REJECTION REASON
                                </div>
                                <div style={{ fontSize: '11px', color: '#7F1D1D' }}>
                                  {doc.rejectionNotes}
                                </div>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openDocument(doc.id)}
                                disabled={downloadingId === doc.id}
                              >
                                {downloadingId === doc.id ? '...' : 'View Document'}
                              </Button>
                              {doc.status !== 'VERIFIED' && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleVerifyItem('document', 'approve', doc.id)}
                                    disabled={submitting === doc.id}
                                  >
                                    {submitting === doc.id ? '...' : 'Approve'}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleVerifyItem('document', 'reject', doc.id)}
                                    disabled={submitting === doc.id || !notes[doc.id]?.trim()}
                                  >
                                    {submitting === doc.id ? '...' : 'Reject'}
                                  </Button>
                                </>
                              )}
                            </div>
                            {doc.status !== 'VERIFIED' && (
                              <textarea
                                placeholder="Notes for trader (required for rejection)"
                                value={notes[doc.id] || ''}
                                onChange={(e) => setNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                                rows={2}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  border: '1px solid #E5E7EB',
                                  fontSize: '11px',
                                  marginTop: '10px',
                                  resize: 'vertical',
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : selectedTrader ? (
          <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-pulse" style={{ color: '#6B7280' }}>Loading verification details...</div>
          </div>
        ) : (
          <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', border: '2px dashed #E5E7EB', borderRadius: '12px', color: '#64748B', fontSize: '14px', padding: '24px', textAlign: 'center', lineHeight: 1.5 }}>
            {traders.length === 0 ? (
              <div>
                <div style={{ fontWeight: 700, color: '#374151', marginBottom: '8px' }}>Nothing to review yet</div>
                <div style={{ fontSize: '13px' }}>When a trader submits company verification, select them from the queue on the left.</div>
              </div>
            ) : (
              'Select a trader from the list to review their details.'
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationInBox;
