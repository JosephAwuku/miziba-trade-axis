"use client";

import React, { useState, useEffect } from 'react';
import { Button, Card } from '../ui';
import { apiClient } from '@/lib/api';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { FilePlusIcon } from '@/components/icons/FilePlusIcon';

const INITIAL_FORM_DATA = {
  companyName: '',
  registrarNumber: '',
  tinNumber: '',
  address: '',
  bankName: '',
  accountNumber: '',
  accountBranch: '',
  swiftCode: '',
  agreed: false,
};

interface TraderOnboardingProps {
  onNotify: (msg: string, type?: string) => void;
}

const KYC_DOC_TYPES = {
  'Certificate of Incorporation': { required: true },
  'TIN Certificate': { required: true },
  'Bank Statement (last 3 months)': { required: true },
  'Director ID (Passport or Ghana Card)': { required: true },
  'Tax Clearance Certificate': { required: false },
  'Export License': { required: false },
} as const;

function buildInitialDocsState() {
  const initial: Record<string, { name: string; status: string; id?: string }> = {};
  Object.keys(KYC_DOC_TYPES).forEach(k => {
    initial[k] = { name: '', status: 'PENDING' };
  });
  return initial;
}

function isDocOnFile(status: string) {
  return status === 'UPLOADED' || status === 'UNDER_REVIEW' || status === 'VERIFIED';
}

type OnboardingFormData = typeof INITIAL_FORM_DATA;

function formSnapshot(data: OnboardingFormData) {
  return {
    companyName: data.companyName,
    registrarNumber: data.registrarNumber,
    tinNumber: data.tinNumber,
    address: data.address,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    accountBranch: data.accountBranch,
    swiftCode: data.swiftCode,
    agreed: data.agreed,
  };
}

function docsSnapshot(docs: Record<string, { name: string; status: string }>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(docs).map(([key, doc]) => [
        key,
        {
          name: doc.name,
          status: doc.status === 'UPLOADING' || doc.status === 'ERROR' ? 'PENDING' : doc.status,
        },
      ])
    )
  );
}

function cloneDocsForBaseline(docs: Record<string, { name: string; status: string }>) {
  return JSON.parse(docsSnapshot(docs)) as Record<string, { name: string; status: string }>;
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  );
}

function docStatusStyle(status: string) {
  if (status === 'VERIFIED' || status === 'UPLOADED') {
    return { bg: '#F0FDF4', c: '#166534', b: '#DCFCE7', label: status === 'VERIFIED' ? 'Verified' : 'Uploaded' };
  }
  if (status === 'UNDER_REVIEW') {
    return { bg: '#FFFBEB', c: '#92400E', b: '#FEF3C7', label: 'Under review' };
  }
  if (status === 'REJECTED') {
    return { bg: '#FEF2F2', c: '#991B1B', b: '#FECACA', label: 'Rejected' };
  }
  return { bg: '#F9FAFB', c: '#6B7280', b: '#F3F4F6', label: 'Not submitted' };
}

const TraderOnboarding: React.FC<TraderOnboardingProps> = ({ onNotify }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    ...INITIAL_FORM_DATA,
  });
  const [baselineFormData, setBaselineFormData] = useState<OnboardingFormData>({ ...INITIAL_FORM_DATA });
  const [baselineDocs, setBaselineDocs] = useState<Record<string, { name: string; status: string }>>(() => buildInitialDocsState());
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [submissionView, setSubmissionView] = useState<'idle' | 'pending' | 'verified'>('idle');
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [verificationDetail, setVerificationDetail] = useState<any>(null);

  const [docs, setDocs] = useState<Record<string, { name: string; status: string; id?: string }>>(() => buildInitialDocsState());
  const [previewingDocId, setPreviewingDocId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const profile = await apiClient.getTraderProfile();
        if (profile) {
          if (profile.is_fully_verified) {
            setSubmissionView('verified');
            setVerifiedAt(profile.kyc_verified_at || null);
          } else if (profile.kyc_status === 'UNDER_REVIEW' || profile.kyc_status === 'REJECTED') {
            setSubmissionView('pending');
            setVerificationDetail(profile.verification || null);
          } else {
            setSubmissionView('idle');
          }
          const loadedFormData: OnboardingFormData = {
            ...INITIAL_FORM_DATA,
            companyName: profile.name || '',
            registrarNumber: profile.registration_no || '',
            tinNumber: profile.tin || '',
            address: profile.address || '',
            bankName: profile.traderProfile?.bank_name || '',
            accountNumber: profile.traderProfile?.bank_account_number || '',
            accountBranch: profile.traderProfile?.bank_account_branch || '',
            swiftCode: profile.traderProfile?.bank_swift || '',
          };
          setFormData(loadedFormData);
          setBaselineFormData(loadedFormData);

          const uploaded = profile.organisation_documents as { id?: string; doc_type?: string; name?: string; status?: string }[] | undefined;
          const loadedDocs = buildInitialDocsState();
          if (uploaded?.length) {
            for (const row of uploaded) {
              const key = row.doc_type;
              if (key && loadedDocs[key]) {
                loadedDocs[key] = {
                  id: row.id,
                  name: row.name || '',
                  status: row.status === 'REJECTED' ? 'PENDING' : (row.status || 'UPLOADED'),
                };
              }
            }
          }
          setDocs(loadedDocs);
          setBaselineDocs(loadedDocs);
          setProfileLoaded(true);
        }
      } catch (err) {
        console.error('Failed to fetch trader profile:', err);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const isDirty =
    submissionView === 'idle' &&
    profileLoaded &&
    (JSON.stringify(formSnapshot(formData)) !== JSON.stringify(formSnapshot(baselineFormData)) ||
      docsSnapshot(docs) !== docsSnapshot(baselineDocs));

  useNavigationGuard(isDirty);

  const steps = [
    { n: 1, l: 'Company Profile' },
    { n: 2, l: 'Documents' },
    { n: 3, l: 'Bank Details' },
    { n: 4, l: 'Final Review' }
  ];

  const handleNext = () => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.companyName.trim()) newErrors.companyName = 'Company legal name is required.';
      if (!formData.registrarNumber.trim()) newErrors.registrarNumber = 'Registrar number is required.';
      if (!formData.tinNumber.trim()) newErrors.tinNumber = 'TIN number is required for tax compliance.';
    }

    if (step === 2) {
      const required = Object.entries(KYC_DOC_TYPES)
        .filter(([, v]) => v.required)
        .map(([k]) => k);
      const missing = required.filter(r => !isDocOnFile(docs[r]?.status || ''));
      if (missing.length > 0) {
        onNotify(`Please upload the following required documents: ${missing.join(', ')}`, 'error');
        return;
      }
    }

    if (step === 3) {
      if (!formData.bankName.trim()) newErrors.bankName = 'Recipient bank name is required.';
      if (!formData.accountNumber.trim()) newErrors.accountNumber = 'Settlement account number is required.';
      if (!formData.accountBranch.trim()) newErrors.accountBranch = 'Bank branch is required for settlement.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      onNotify('Verification failed. Please complete the missing fields.', 'error');
      return;
    }

    setStep(s => Math.min(4, s + 1));
  };

  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDoc) return;

    // Optional: Size check
    if (file.size > 10 * 1024 * 1024) {
      onNotify('File too large. Max size is 10MB.', 'error');
      return;
    }

    setDocs(prev => ({
      ...prev,
      [activeDoc]: { ...prev[activeDoc], status: 'UPLOADING' }
    }));

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', activeDoc);

      const result = await apiClient.uploadCompanyDocument(fd);

      setDocs(prev => ({
        ...prev,
        [activeDoc]: {
          name: file.name,
          status: 'UPLOADED',
          id: (result as { id?: string }).id || prev[activeDoc]?.id,
        },
      }));
      onNotify(`${activeDoc} uploaded successfully.`, 'success');
      const input = document.getElementById('onboarding-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (err: any) {
      setDocs(prev => ({
        ...prev,
        [activeDoc]: { ...prev[activeDoc], status: 'ERROR' }
      }));
      onNotify(err.message || 'Upload failed', 'error');
    }
  };

  const handlePreviewDocument = async (docId: string) => {
    setPreviewingDocId(docId);
    try {
      const { url } = await apiClient.getTraderCompanyDocumentSignedUrl(docId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      onNotify(err.message || 'Could not open document.', 'error');
    } finally {
      setPreviewingDocId(null);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiClient.submitTraderVerification(formData);
      setBaselineFormData({ ...formData });
      setBaselineDocs(cloneDocsForBaseline(docs));
      setSubmissionView('pending');
      onNotify('Verification request submitted successfully!', 'success');
    } catch (err: any) {
      onNotify(err.message || 'Failed to submit verification.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="fade-in" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="animate-pulse" style={{ color: '#94A3B8', fontSize: '14px' }}>
          Loading company profile...
        </div>
      </div>
    );
  }

  if (submissionView === 'verified') {
    const verifiedDocCount = Object.values(docs).filter(d => d.status === 'VERIFIED' || d.status === 'UPLOADED').length;
    const formattedVerifiedAt = verifiedAt
      ? new Date(verifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    if (loading) {
      return (
        <div className="animate-pulse fade-in" style={{ color: '#94A3B8', fontSize: '14px', padding: '40px' }}>
          Loading verification details...
        </div>
      );
    }

    return (
      <div className="fade-in">
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Company Profile</h2>
            <p style={{ color: '#6B7280', marginTop: '4px', fontSize: '14px' }}>
              Your submitted company details as approved by Miziba. Editing will be available in a future update.
            </p>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '99px',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              color: 'var(--pu)',
              background: 'var(--pu-bg)',
              border: '1.5px solid transparent',
              backgroundImage: 'linear-gradient(var(--pu-bg), var(--pu-bg)), linear-gradient(135deg, var(--cr), var(--pu))',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--pu)', flexShrink: 0 }} />
            Verified
          </span>
        </div>

        <Card
          style={{
            marginBottom: '24px',
            padding: '20px 24px',
            background: 'var(--pu-bg)',
            border: '1.5px solid transparent',
            backgroundImage: 'linear-gradient(var(--pu-bg), var(--pu-bg)), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--pu)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--pu)', marginBottom: '4px' }}>Company verified</div>
              <p style={{ fontSize: '14px', color: '#5B21B6', margin: 0, lineHeight: 1.55 }}>
                Miziba has approved your organisation.{formattedVerifiedAt ? ` Verified on ${formattedVerifiedAt}.` : ''} You can submit trade applications from the Trader portal.
              </p>
            </div>
          </div>
        </Card>

        <div className="g2-responsive" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cr)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Identity</h3>
                <Button variant="ghost" size="sm" style={{ fontWeight: 700, color: 'var(--pu)', opacity: 0.5, cursor: 'not-allowed' }} disabled>
                  Edit Details
                </Button>
              </div>
              <div className="g2" style={{ gap: '20px' }}>
                <ProfileField label="Legal Name" value={formData.companyName} />
                <ProfileField label="Reg Number" value={formData.registrarNumber} />
                <ProfileField label="TIN Number" value={formData.tinNumber} />
                <ProfileField label="Registered Address" value={formData.address} />
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cr)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank & Settlement</h3>
                <Button variant="ghost" size="sm" style={{ fontWeight: 700, color: 'var(--pu)', opacity: 0.5, cursor: 'not-allowed' }} disabled>
                  Update Bank
                </Button>
              </div>
              <div className="g2" style={{ gap: '20px' }}>
                <ProfileField label="Settlement Bank" value={formData.bankName} />
                <ProfileField label="Account Number" value={formData.accountNumber} />
                <ProfileField label="Branch" value={formData.accountBranch} />
                <ProfileField label="SWIFT / Routing" value={formData.swiftCode} />
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cr)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compliance Documents</h3>
              <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 600 }}>
                {verifiedDocCount}/{Object.keys(KYC_DOC_TYPES).length} on file
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bdr)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--bdr)' }}>
              {Object.entries(KYC_DOC_TYPES).map(([docType, meta]) => {
                const info = docs[docType] || { name: '', status: 'PENDING' };
                const st = docStatusStyle(info.name ? info.status : 'PENDING');
                return (
                  <div
                    key={docType}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#fff' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>
                        {docType}
                        {meta.required && <span style={{ color: 'var(--cr)', marginLeft: '4px' }}>*</span>}
                      </div>
                      {info.name && (
                        <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {info.name}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        background: st.bg,
                        color: st.c,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.02em',
                        border: `1px solid ${st.b}`,
                        flexShrink: 0,
                      }}
                    >
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (submissionView === 'pending') {
    const vd = verificationDetail;

    type ItemState = 'verified' | 'rejected' | 'pending';
    const itemStyle = (st: ItemState) => {
      if (st === 'verified') return { bg: 'var(--pu-bg)', color: 'var(--pu)', border: 'var(--pu)', label: 'Approved' };
      if (st === 'rejected') return { bg: '#FEF2F2', color: '#DC2626', border: '#FCA5A5', label: 'Rejected' };
      return { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0', label: 'Under Review' };
    };

    const profileState: ItemState = vd?.companyProfile?.verified ? 'verified' : (vd?.companyProfile?.rejectionNotes ? 'rejected' : 'pending');
    const bankState: ItemState = vd?.bankDetails?.verified ? 'verified' : (vd?.bankDetails?.rejectionNotes ? 'rejected' : 'pending');

    const hasAnyRejection = profileState === 'rejected' || bankState === 'rejected' ||
      (vd?.documents || []).some((d: any) => d.status === 'REJECTED');

    const StatusPill = ({ state }: { state: ItemState }) => {
      const s = itemStyle(state);
      return (
        <span style={{
          fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em',
          padding: '3px 9px', borderRadius: '6px',
          background: s.bg, color: s.color, border: `1px solid ${s.border}`,
          flexShrink: 0,
        }}>
          {s.label}
        </span>
      );
    };

    const ItemRow = ({ label, state, note }: { label: string; state: ItemState; note?: string }) => (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '13px 16px', background: '#fff', borderBottom: '1px solid var(--bdr)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>{label}</div>
          {note && (
            <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '3px', lineHeight: 1.4 }}>
              {note}
            </div>
          )}
        </div>
        <StatusPill state={state} />
      </div>
    );

    return (
      <div className="fade-in">
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Company Profile</h2>
            <p style={{ color: '#6B7280', marginTop: '4px', fontSize: '14px' }}>
              Verification in progress — our compliance desk is reviewing your submission.
            </p>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', borderRadius: '99px',
            fontSize: '12px', fontWeight: 800, letterSpacing: '0.02em',
            color: hasAnyRejection ? '#DC2626' : '#64748B',
            background: hasAnyRejection ? '#FEF2F2' : '#F1F5F9',
            border: `1.5px solid ${hasAnyRejection ? '#FCA5A5' : '#E2E8F0'}`,
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: hasAnyRejection ? '#DC2626' : '#94A3B8', flexShrink: 0 }} />
            {hasAnyRejection ? 'Action Required' : 'Under Review'}
          </span>
        </div>

        {hasAnyRejection && (
          <Card style={{
            marginBottom: '24px', padding: '16px 20px',
            background: '#FEF2F2',
            border: '1.5px solid #FCA5A5',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626', marginBottom: '4px' }}>Some items need your attention</div>
            <p style={{ fontSize: '13px', color: '#B91C1C', margin: 0, lineHeight: 1.5 }}>
              One or more items were rejected. Review the notes below, correct them, and re-submit.
            </p>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Company Profile */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Identity</span>
              <StatusPill state={profileState} />
            </div>
            <ItemRow label="Legal name, registration number, TIN, address" state={profileState} note={vd?.companyProfile?.rejectionNotes || undefined} />
          </Card>

          {/* Bank Details */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank & Settlement</span>
              <StatusPill state={bankState} />
            </div>
            <ItemRow label="Settlement bank, account number, SWIFT / routing" state={bankState} note={vd?.bankDetails?.rejectionNotes || undefined} />
          </Card>

          {/* Documents */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compliance Documents</span>
            </div>
            {vd?.documents && vd.documents.length > 0 ? (
              vd.documents.map((doc: any) => {
                const docState: ItemState = doc.status === 'VERIFIED' ? 'verified' : doc.status === 'REJECTED' ? 'rejected' : 'pending';
                return (
                  <ItemRow
                    key={doc.id || doc.doc_type}
                    label={doc.doc_type || doc.type || 'Document'}
                    state={docState}
                    note={doc.rejectionNotes || doc.rejection_notes || undefined}
                  />
                );
              })
            ) : (
              Object.entries(KYC_DOC_TYPES).map(([docType]) => {
                const info = docs[docType];
                const docState: ItemState = info?.status === 'VERIFIED' ? 'verified' : info?.status === 'REJECTED' ? 'rejected' : 'pending';
                return <ItemRow key={docType} label={docType} state={docState} />;
              })
            )}
          </Card>
        </div>

        <p style={{ marginTop: '20px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
          This page refreshes automatically. You will receive a notification when a decision is made.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>Company Profile</h2>
        <p style={{ color: '#6B7280', marginTop: '4px' }}>
          Complete your organisation profile, upload compliance documents, and submit for Miziba approval. Trade-specific files (contracts, B/L,
          etc.) are added separately on each deal under Trade documents.
        </p>
      </div>

      <div className="card" style={{ padding: '40px' }}>
        <div className="tabs" style={{ marginBottom: '32px', borderBottom: '1px solid var(--bdr)', display: 'flex' }}>
          {steps.map((s, i) => (
            <button
              key={s.n}
              className={`tab ${step === s.n ? 'on' : ''}`}
              style={{
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderBottom: step === s.n ? '2px solid var(--cr)' : '2px solid transparent',
                color: step === s.n ? 'var(--cr)' : 'var(--text3)',
                fontWeight: 600,
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                if (s.n < step) {
                  setStep(s.n);
                  setErrors({});
                }
              }}
            >
              {s.n}. {s.l}
            </button>
          ))}
        </div>

        <div className="fade-in">
          {step === 1 && (
            <div className="g2 g-compact">
              <div className="field">
                <label>Company Legal Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={e => {
                    setFormData({ ...formData, companyName: e.target.value });
                    if (errors.companyName) setErrors({ ...errors, companyName: '' });
                  }}
                  className={errors.companyName ? 'err' : ''}
                />
                {errors.companyName && <div className="field-error">{errors.companyName}</div>}
              </div>
              <div className="field">
                <label>Registrar Number (GRL)</label>
                <input
                  type="text"
                  value={formData.registrarNumber}
                  onChange={e => {
                    setFormData({ ...formData, registrarNumber: e.target.value });
                    if (errors.registrarNumber) setErrors({ ...errors, registrarNumber: '' });
                  }}
                  className={errors.registrarNumber ? 'err' : ''}
                />
                {errors.registrarNumber && <div className="field-error">{errors.registrarNumber}</div>}
              </div>
              <div className="field">
                <label>TIN Number</label>
                <input
                  type="text"
                  value={formData.tinNumber}
                  onChange={e => {
                    setFormData({ ...formData, tinNumber: e.target.value });
                    if (errors.tinNumber) setErrors({ ...errors, tinNumber: '' });
                  }}
                  className={errors.tinNumber ? 'err' : ''}
                />
                {errors.tinNumber && <div className="field-error">{errors.tinNumber}</div>}
              </div>
              <div className="field">
                <label>Registered Address</label>
                <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                id="onboarding-file-input"
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/*"
              />
              {Object.entries(docs).map(([doc, info]) => (
                <div
                  key={doc}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: '1.5px solid transparent',
                    backgroundImage: isDocOnFile(info.status)
                      ? 'linear-gradient(var(--pu-bg), var(--pu-bg)), linear-gradient(135deg, var(--cr), var(--pu))'
                      : 'linear-gradient(#F8FAFC, #F8FAFC), linear-gradient(135deg, var(--cr), var(--pu))',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: isDocOnFile(info.status) ? 'var(--pu-bg)' : '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <FilePlusIcon
                        size={20}
                        color={isDocOnFile(info.status) ? 'var(--pu)' : 'var(--cr)'}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{doc}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>
                        {info.name || (KYC_DOC_TYPES[doc as keyof typeof KYC_DOC_TYPES]?.required === false ? 'Optional · PDF, JPG, PNG, DOC' : 'Required · PDF, JPG, PNG, DOC')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {isDocOnFile(info.status) && info.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={previewingDocId === info.id}
                        onClick={() => handlePreviewDocument(info.id!)}
                      >
                        {previewingDocId === info.id ? '…' : 'Preview'}
                      </Button>
                    )}
                    <Button
                      variant={isDocOnFile(info.status) ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={info.status === 'UPLOADING'}
                      onClick={() => {
                        setActiveDoc(doc);
                        document.getElementById('onboarding-file-input')?.click();
                      }}
                    >
                      {info.status === 'UPLOADING' ? '...' : isDocOnFile(info.status) ? 'Replace' : 'Upload'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="g2">
              <div className="field">
                <label>Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. Standard Chartered"
                  value={formData.bankName}
                  onChange={e => {
                    setFormData({ ...formData, bankName: e.target.value });
                    if (errors.bankName) setErrors({ ...errors, bankName: '' });
                  }}
                  className={errors.bankName ? 'err' : ''}
                />
                {errors.bankName && <div className="field-error">{errors.bankName}</div>}
              </div>
              <div className="field">
                <label>Account Number</label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={e => {
                    setFormData({ ...formData, accountNumber: e.target.value });
                    if (errors.accountNumber) setErrors({ ...errors, accountNumber: '' });
                  }}
                  className={errors.accountNumber ? 'err' : ''}
                />
                {errors.accountNumber && <div className="field-error">{errors.accountNumber}</div>}
              </div>
              <div className="field">
                <label>Bank Branch</label>
                <input
                  type="text"
                  value={formData.accountBranch}
                  onChange={e => {
                    setFormData({ ...formData, accountBranch: e.target.value });
                    if (errors.accountBranch) setErrors({ ...errors, accountBranch: '' });
                  }}
                  className={errors.accountBranch ? 'err' : ''}
                />
                {errors.accountBranch && <div className="field-error">{errors.accountBranch}</div>}
              </div>
              <div className="field">
                <label>SWIFT / BIC Code</label>
                <input type="text" value={formData.swiftCode} onChange={e => setFormData({ ...formData, swiftCode: e.target.value })} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className="alert" style={{
                  background: 'linear-gradient(135deg, #FFF5F5, #FFF0F7)',
                  border: '1.5px solid var(--cr-b)',
                  color: 'var(--cr)',
                  padding: '20px 24px',
                  borderRadius: '16px',
                  fontSize: '15px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 4px 15px rgba(139, 0, 0, 0.04)'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Important: Settlement bank name must match the company legal name.
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="fade-in">
              <div style={{
                padding: '28px 40px',
                marginBottom: '32px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
                border: '1.5px solid transparent',
                backgroundImage: 'linear-gradient(#FFF9F9, #FFF9F9), linear-gradient(135deg, var(--cr), var(--pu))',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                borderRadius: '16px'
              }}>
                <div style={{ fontWeight: 800, fontSize: '24px', color: 'var(--text)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                  Verify Your Details
                </div>
                <p style={{ fontSize: '16px', color: 'var(--text2)', fontWeight: 500, lineHeight: 1.6, maxWidth: '800px' }}>
                  Please cross-check all information recorded below. If everything is accurate, check the legal agreement at the bottom of the page to submit your profile for official review.
                </p>
              </div>

              <div className="g2" style={{ marginBottom: '32px' }}>
                <div className="card" style={{ padding: '24px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cr)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Identity</h3>
                    <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--pu)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Legal Name', val: formData.companyName },
                      { label: 'Reg Number', val: formData.registrarNumber },
                      { label: 'TIN Number', val: formData.tinNumber },
                      { label: 'Address', val: formData.address }
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '2px' }}>{item.label}</div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{item.val || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ padding: '24px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cr)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank & Settlement</h3>
                    <button onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: 'var(--pu)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Bank Name', val: formData.bankName },
                      { label: 'Account Number', val: formData.accountNumber },
                      { label: 'Branch', val: formData.accountBranch },
                      { label: 'Swift/Routing', val: formData.swiftCode }
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '2px' }}>{item.label}</div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{item.val || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '32px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: 'var(--text)' }}>Legal Declaration</h3>
                <p style={{ fontSize: '15px', color: 'var(--text2)', lineHeight: 1.7, marginBottom: '24px' }}>
                  By clicking submit, you confirm that all information provided is accurate and you are authorized to act on behalf of the company. TradeAxis reserves the right to request additional documentation during the KYC review process.
                </p>
                <div
                  onClick={() => setFormData({ ...formData, agreed: !formData.agreed })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '24px 28px',
                    background: formData.agreed ? '#FFF9F9' : '#fff',
                    borderRadius: '16px',
                    border: '2px solid transparent',
                    backgroundImage: `linear-gradient(${formData.agreed ? '#FFF9F9' : '#fff'}, ${formData.agreed ? '#FFF9F9' : '#fff'}), linear-gradient(135deg, var(--cr), var(--pu))`,
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                    boxShadow: formData.agreed ? '0 4px 12px rgba(139, 0, 0, 0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: formData.agreed ? 'var(--cr)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    border: '2px solid transparent',
                    backgroundImage: formData.agreed
                      ? 'none'
                      : 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                    boxShadow: formData.agreed ? '0 4px 12px rgba(139, 0, 0, 0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s'
                  }}>
                    {formData.agreed && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6L9 17l-5-5"></path>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: formData.agreed ? 'var(--cr)' : 'var(--text2)' }}>
                    I agree to the Terms of Service and Data Processing Agreements.
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              className="btn btn-secondary btn-form"
              disabled={step === 1}
              onClick={() => setStep(s => Math.max(1, s - 1))}
            >
              Previous
            </button>
            {step < 4 ? (
              <Button className="btn-form" onClick={handleNext}>Next Step →</Button>
            ) : (
              <Button className="btn-form" onClick={handleSubmit} disabled={loading || !formData.agreed} variant="primary">
                {loading ? 'Submitting...' : 'Submit for Verification'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraderOnboarding;
