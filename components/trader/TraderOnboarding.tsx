"use client";

import React, { useState } from 'react';
import { Button, Card, ProgressBar } from '../ui';
import { apiClient } from '@/lib/api';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';

const INITIAL_FORM_DATA = {
  companyName: 'Wenchi Cashew Alliance',
  registrarNumber: 'GRL-8829-X',
  tinNumber: 'T001229384',
  address: 'Plot 42, Wenchi Main Rd, Bono Region',
  bankName: '',
  accountNumber: '',
  accountBranch: '',
  swiftCode: '',
  agreed: false,
};

interface TraderOnboardingProps {
  onNotify: (msg: string, type?: string) => void;
}

const TraderOnboarding: React.FC<TraderOnboardingProps> = ({ onNotify }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    ...INITIAL_FORM_DATA,
    isSubmitted: false
  });

  const isDirty = !formData.isSubmitted && JSON.stringify({
    companyName: formData.companyName,
    registrarNumber: formData.registrarNumber,
    tinNumber: formData.tinNumber,
    address: formData.address,
    bankName: formData.bankName,
    accountNumber: formData.accountNumber,
    accountBranch: formData.accountBranch,
    swiftCode: formData.swiftCode,
    agreed: formData.agreed,
  }) !== JSON.stringify(INITIAL_FORM_DATA);

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

    if (step === 3) {
      if (!formData.bankName.trim()) newErrors.bankName = 'Recipient bank name is required.';
      if (!formData.accountNumber.trim()) newErrors.accountNumber = 'Settlement account number is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      onNotify('Verification failed. Please complete the missing fields.', 'error');
      return;
    }

    setStep(s => Math.min(4, s + 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiClient.submitTraderVerification(formData);
      setFormData(prev => ({ ...prev, isSubmitted: true }));
      onNotify('Verification request submitted successfully!', 'success');
    } catch (err: any) {
      onNotify(err.message || 'Failed to submit verification.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (formData.isSubmitted) {
    return (
      <div className="fade-in">
        <Card style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--cr)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" opacity="0.2" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Verification Under Review</h2>
          <p style={{ marginTop: '12px', color: '#6B7280', maxWidth: '400px', margin: '12px auto' }}>
            Our compliance desk is reviewing your documents. This usually takes 24-48 hours. You will receive an email once your account is verified for deal submission.
          </p>
          <div style={{ marginTop: '32px', padding: '16px', background: '#F8FAFC', borderRadius: '12px', display: 'inline-block' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#64748B' }}>CASE REF: KYCV-{Math.floor(1000 + Math.random() * 9000)}</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>Company Verification</h2>
        <p style={{ color: '#6B7280', marginTop: '4px' }}>Follow the steps to verify your business for trade finance access.</p>
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
                fontSize: '12px',
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
            <div className="g2" style={{ gap: '32px' }}>
              <div className="field">
                <label>Company Legal Name</label>
                <input 
                    type="text" 
                    value={formData.companyName} 
                    onChange={e => {
                        setFormData({...formData, companyName: e.target.value});
                        if (errors.companyName) setErrors({...errors, companyName: ''});
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
                        setFormData({...formData, registrarNumber: e.target.value});
                        if (errors.registrarNumber) setErrors({...errors, registrarNumber: ''});
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
                        setFormData({...formData, tinNumber: e.target.value});
                        if (errors.tinNumber) setErrors({...errors, tinNumber: ''});
                    }} 
                    className={errors.tinNumber ? 'err' : ''}
                />
                {errors.tinNumber && <div className="field-error">{errors.tinNumber}</div>}
              </div>
              <div className="field">
                <label>Registered Address</label>
                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                'Certificate of Incorporation',
                'TIN Certificate',
                'Export License (Optional)',
                'Director ID (Passport)'
              ].map(doc => (
                <div 
                  key={doc} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '20px 24px', 
                    background: '#F8FAFC', 
                    borderRadius: '12px', 
                    border: '1.5px solid transparent',
                    backgroundImage: 'linear-gradient(#F8FAFC, #F8FAFC), linear-gradient(135deg, var(--cr), var(--pu))',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box'
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{doc}</div>
                  <button 
                    className="btn btn-sm" 
                    style={{ 
                      background: '#fff',
                      border: '2px solid transparent',
                      backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
                      backgroundOrigin: 'border-box',
                      backgroundClip: 'padding-box, border-box',
                      fontWeight: 700,
                      color: 'var(--text)',
                      minWidth: '160px'
                    }}
                  >
                    Upload PDF / IMG
                  </button>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div className="field">
                <label>Bank Name</label>
                <input 
                    type="text" 
                    placeholder="e.g. GCB Bank" 
                    value={formData.bankName} 
                    onChange={e => {
                        setFormData({...formData, bankName: e.target.value});
                        if (errors.bankName) setErrors({...errors, bankName: ''});
                    }} 
                    className={errors.bankName ? 'err' : ''}
                />
                {errors.bankName && <div className="field-error">{errors.bankName}</div>}
              </div>
              <div className="field">
                <label>Account Number</label>
                <input 
                    type="text" 
                    placeholder="Settlement account number" 
                    value={formData.accountNumber} 
                    onChange={e => {
                        setFormData({...formData, accountNumber: e.target.value});
                        if (errors.accountNumber) setErrors({...errors, accountNumber: ''});
                    }} 
                    className={errors.accountNumber ? 'err' : ''}
                />
                {errors.accountNumber && <div className="field-error">{errors.accountNumber}</div>}
              </div>
              <div>
                <label>Account Branch</label>
                <input type="text" placeholder="Branch name/location" value={formData.accountBranch} onChange={e => setFormData({...formData, accountBranch: e.target.value})} />
              </div>
              <div>
                <label>Swift Code / Routing</label>
                <input type="text" placeholder="Bank SWIFT" value={formData.swiftCode} onChange={e => setFormData({...formData, swiftCode: e.target.value})} />
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

              <div className="g2" style={{ gap: '32px', marginBottom: '32px' }}>
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
                  onClick={() => setFormData({...formData, agreed: !formData.agreed})}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #F3F4F6' }}>
            <button 
              className="btn btn-secondary" 
              disabled={step === 1} 
              onClick={() => setStep(s => Math.max(1, s - 1))}
            >
              Previous
            </button>
            {step < 4 ? (
              <Button onClick={handleNext}>Next Step →</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading || !formData.agreed} variant="primary">
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
