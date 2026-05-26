"use client";

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { TradeApplicationInput, BuyerProfile } from '@/lib/types';
import { Button, CustomSelect, CustomDatePicker } from '@/components/ui';
import { CMD } from '@/lib/data';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import TraderKycReminderCard from './TraderKycReminderCard';
import TraderDocuments from './TraderDocuments';
import {
  countMissingRequiredTradeDocs,
  hasAllRequiredTradeDocs,
  type TradeDocumentRecord,
} from '@/lib/trade-documents';

const INITIAL_FORM_DATA: Partial<TradeApplicationInput> = {
  commodity: 'cashew',
  grade: 'A',
  volume_mt: 0,
  buyer_id: '',
  price_per_mt_usd: 0,
  procurement_cost_usd: 0,
  trader_equity_usd: 0,
  finance_facility_usd: 0,
  delivery_point: '',
  deadline_date: '',
  payment_terms_days: 30,
};
const MIN_EQUITY_PCT = 0.35;

const fmtUsd = (n: number | undefined | null) =>
  n != null && Number.isFinite(n) ? `$${Number(n).toLocaleString()}` : '—';

interface ApplicationFormProps {
  onSuccess: (trade: any) => void;
  onNotify: (msg: string, type?: string) => void;
  onNavigate: (subView: string) => void;
  draftId?: string;
  onDraftSaved?: () => void;
}

const ApplicationForm: React.FC<ApplicationFormProps> = ({ onSuccess, onNotify, onNavigate, draftId, onDraftSaved }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [canSubmitTrades, setCanSubmitTrades] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Partial<TradeApplicationInput>>(INITIAL_FORM_DATA);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId);
  const [savingDraft, setSavingDraft] = useState(false);
  const [tradeDocuments, setTradeDocuments] = useState<TradeDocumentRecord[]>([]);
  const [docError, setDocError] = useState('');

  useEffect(() => {
    const loadKyc = async () => {
      try {
        const profile = await apiClient.getTraderProfile();
        setCanSubmitTrades(profile.can_submit_trades === true || profile.is_fully_verified === true);
      } catch {
        setCanSubmitTrades(false);
      } finally {
        setProfileLoading(false);
      }
    };
    loadKyc();
  }, []);

  // Load from draft or local storage on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (draftId) {
        try {
          const { draft } = await apiClient.getDraft(draftId);
          if (draft?.draft_data) {
            const { trade_documents: _docs, ...draftFields } = draft.draft_data as Record<string, unknown>;
            setFormData(prev => ({ ...prev, ...draftFields }));
            setStep(Math.min(draft.last_edited_step || 1, 4));
            setCurrentDraftId(draft.id);
          }
        } catch (e) {
          console.error('Failed to load draft', e);
          onNotify('Failed to load draft', 'error');
        }
      } else {
        const saved = localStorage.getItem('tradeaxis_pending_trade');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setFormData(prev => ({ ...prev, ...parsed }));
            const savedStep = localStorage.getItem('tradeaxis_pending_step');
            if (savedStep) setStep(parseInt(savedStep));
          } catch (e) {
            console.error('Failed to restore form data', e);
          }
        }
      }
    };
    loadDraft();
  }, [draftId]);

  // Save to local storage on change
  useEffect(() => {
    if (!isSubmitted) {
      localStorage.setItem('tradeaxis_pending_trade', JSON.stringify(formData));
      localStorage.setItem('tradeaxis_pending_step', step.toString());
    } else {
      localStorage.removeItem('tradeaxis_pending_trade');
      localStorage.removeItem('tradeaxis_pending_step');
    }
  }, [formData, step, isSubmitted]);

  // Check if form is dirty by comparing with INITIAL_FORM_DATA
  const isDirty = !isSubmitted && JSON.stringify(formData) !== JSON.stringify(INITIAL_FORM_DATA);

  useNavigationGuard(isDirty);

  useEffect(() => {
    fetchBuyers();
  }, []);

  useEffect(() => {
    if (step !== 4) setTermsAccepted(false);
  }, [step]);

  useEffect(() => {
    if (!currentDraftId) {
      setTradeDocuments([]);
      return;
    }
    apiClient
      .getDraftDocuments(currentDraftId)
      .then((res) => setTradeDocuments(res.documents || []))
      .catch(() => {});
  }, [currentDraftId, step]);

  const fetchBuyers = async () => {
    try {
      const data = await apiClient.getBuyers();
      setBuyers(data);
    } catch (err) {
      console.error('Failed to fetch buyers:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'number' ? parseFloat(value) : value;

    setFormData(prev => {
      const next = { ...prev, [name]: val };

      // Clear error for this field
      if (errors[name]) setErrors(e => {
        const { [name]: removed, ...rest } = e;
        return rest;
      });

      // Auto-calculate derived values
      if (name === 'volume_mt' || name === 'price_per_mt_usd') {
        const vol = name === 'volume_mt' ? (val as number) : (prev.volume_mt || 0);
        const price = name === 'price_per_mt_usd' ? (val as number) : (prev.price_per_mt_usd || 0);
        // Procurement cost is usually approx 80-85% of contract value in this model
        if (!next.procurement_cost_usd) {
          next.procurement_cost_usd = vol * price * 0.8;
          const procurement = next.procurement_cost_usd || 0;
          next.trader_equity_usd = Math.round(procurement * MIN_EQUITY_PCT * 100) / 100;
          next.finance_facility_usd = Math.round((procurement - (next.trader_equity_usd || 0)) * 100) / 100;
        }
      }

      // Auto-split when procurement cost is entered (editable afterwards by user)
      if (name === 'procurement_cost_usd') {
        const procurement = Number.isFinite(val as number) ? (val as number) : 0;
        next.trader_equity_usd = Math.round(procurement * MIN_EQUITY_PCT * 100) / 100;
        next.finance_facility_usd = Math.round((procurement - (next.trader_equity_usd || 0)) * 100) / 100;
      }

      return next;
    });
  };

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!formData.commodity) e.commodity = 'Commodity selection is required.';
      if (!formData.grade) e.grade = 'Grade is required.';
      if (!formData.buyer_id) e.buyer_id = 'Please select a buyer.';
      if (!formData.volume_mt || formData.volume_mt <= 0) e.volume_mt = 'Enter a valid volume in MT.';
      if (!formData.price_per_mt_usd || formData.price_per_mt_usd <= 0) e.price_per_mt_usd = 'Enter a valid price per MT.';
      if (!formData.delivery_point) e.delivery_point = 'Delivery point is required.';
      if (!formData.deadline_date) e.deadline_date = 'Please set a deal deadline.';
    }
    if (step === 3) {
      if (!formData.procurement_cost_usd) e.procurement_cost_usd = 'Procurement cost is required.';
      if (!formData.trader_equity_usd) e.trader_equity_usd = 'Trader equity is required.';
      if (!formData.finance_facility_usd) e.finance_facility_usd = 'Finance facility amount is required.';

      const equityPct = (formData.trader_equity_usd || 0) / (formData.procurement_cost_usd || 1);
      if (equityPct < 0.35) e.trader_equity_usd = 'Minimum equity must be 35% of procurement cost.';

      const total = (formData.trader_equity_usd || 0) + (formData.finance_facility_usd || 0);
      if (Math.abs(total - (formData.procurement_cost_usd || 0)) > 10) {
        e.finance_facility_usd = 'Equity + Facility must equal Procurement Cost.';
      }
    }

    if (Object.keys(e).length > 0) {
      setErrors(e);
      onNotify('Please complete the highlighted fields.', 'error');
      return false;
    }
    setErrors({});
    return true;
  };

  const buildDraftPayload = async (editedStep: number) => {
    let trade_documents: TradeDocumentRecord[] | undefined;
    if (currentDraftId) {
      try {
        const { draft } = await apiClient.getDraft(currentDraftId);
        trade_documents = (draft?.draft_data as { trade_documents?: TradeDocumentRecord[] })?.trade_documents;
      } catch {
        trade_documents = tradeDocuments.length > 0 ? tradeDocuments : undefined;
      }
    }

    return {
      draft_data: {
        ...formData,
        ...(trade_documents?.length ? { trade_documents } : {}),
      },
      last_edited_step: editedStep,
      title: formData.commodity
        ? `${CMD[formData.commodity as keyof typeof CMD]?.l || formData.commodity} - ${formData.volume_mt || 0} MT`
        : undefined,
    };
  };

  const ensureDraftExists = async (): Promise<string | undefined> => {
    if (currentDraftId) return currentDraftId;

    const { draft } = await apiClient.saveDraft(await buildDraftPayload(step));
    setCurrentDraftId(draft.id);
    return draft.id;
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const draftData = await buildDraftPayload(step);

      if (currentDraftId) {
        await apiClient.updateDraft(currentDraftId, draftData);
        onNotify('Draft updated successfully', 'success');
      } else {
        const { draft } = await apiClient.saveDraft(draftData);
        setCurrentDraftId(draft.id);
        onNotify('Draft saved successfully', 'success');
      }
      
      if (onDraftSaved) onDraftSaved();
    } catch (err: any) {
      onNotify(err.message || 'Failed to save draft', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const canSubmitToSystem = canSubmitTrades;

  const requiredDocsMissing = countMissingRequiredTradeDocs(tradeDocuments);
  const canSubmitDocuments = hasAllRequiredTradeDocs(tradeDocuments);

  const handleSubmit = async () => {
    if (!canSubmitToSystem) {
      onNotify(
        'Your company must be verified by CEO or Operations Admin before you can submit a trade to Miziba. Save your work as a draft instead.',
        'warning'
      );
      return;
    }
    if (!currentDraftId) {
      onNotify('Save your application as a draft and upload required trade documents before submitting.', 'warning');
      return;
    }
    if (!canSubmitDocuments) {
      setDocError(`Upload all required trade documents (${requiredDocsMissing} missing).`);
      onNotify(
        `Upload all required trade documents before submitting. ${requiredDocsMissing} required document${requiredDocsMissing === 1 ? '' : 's'} still missing — save as draft and complete step 2.`,
        'warning'
      );
      return;
    }
    if (!termsAccepted) {
      setTermsError('Please confirm the terms before submitting.');
      onNotify('Please confirm the terms before submitting.', 'error');
      return;
    }
    setTermsError('');
    setDocError('');
    setLoading(true);
    try {
      const result = await apiClient.createTrade({
        ...(formData as TradeApplicationInput),
        draft_id: currentDraftId,
      });
      setIsSubmitted(true);
      
      localStorage.removeItem('tradeaxis_pending_trade');
      localStorage.removeItem('tradeaxis_pending_step');
      
      setFormData(INITIAL_FORM_DATA);
      setStep(1);
      setTermsAccepted(false);
      setErrors({});
      setDocError('');
      setTradeDocuments([]);
      setCurrentDraftId(undefined);
      
      onNotify('Application submitted successfully!', 'success');
      onSuccess(result);
    } catch (err: any) {
      onNotify(err.message || 'Failed to submit application', 'error');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Offtake Contract', 'Trade Documents', 'Equity & Terms', 'Submit'];

  if (profileLoading) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>
        Checking verification status…
      </div>
    );
  }

  return (
    <div>
    {!canSubmitTrades && (
      <TraderKycReminderCard
        onNavigateToCompany={() => onNavigate('company')}
        marginBottom="20px"
      />
    )}
    <div className="card" style={{ padding: '40px' }}>
      <div className="tabs" style={{ marginBottom: '32px', borderBottom: '1px solid var(--bdr)', display: 'flex' }}>
        {steps.map((l, i) => (
          <button
            key={l}
            className={`tab ${step === i + 1 ? 'on' : ''}`}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: step === i + 1 ? '3px solid var(--cr)' : '3px solid transparent',
              color: step === i + 1 ? 'var(--cr)' : 'var(--text3)',
              fontWeight: 600,
              fontSize: '14px'
            }}
            onClick={() => {
              if (i + 1 < step) setStep(i + 1);
            }}
          >
            {i + 1}. {l}
          </button>
        ))}
      </div>

      <div className="fade-in">
        {step === 1 && (
          <div className="g2 g-compact">
            <div className="field">
              <label>Commodity *</label>
              <CustomSelect
                name="commodity"
                value={formData.commodity}
                onChange={handleChange}
                options={Object.entries(CMD).map(([val, cfg]) => ({ label: cfg.l, value: val }))}
                error={!!errors.commodity}
              />
              {errors.commodity && <div className="field-error">{errors.commodity}</div>}
            </div>
            <div className="field">
              <label>Grade *</label>
              <CustomSelect
                name="grade"
                value={formData.grade}
                onChange={handleChange}
                options={[
                  { label: 'Grade A', value: 'A' },
                  { label: 'Grade B', value: 'B' },
                  { label: 'Grade C', value: 'C' }
                ]}
                error={!!errors.grade}
              />
              {errors.grade && <div className="field-error">{errors.grade}</div>}
            </div>
            <div className="field">
              <label>Buyer *</label>
              <CustomSelect
                name="buyer_id"
                value={formData.buyer_id}
                onChange={handleChange}
                placeholder="Select Buyer"
                options={buyers.map(b => ({ label: `${b.name} (${b.country})`, value: b.id }))}
                error={!!errors.buyer_id}
              />
              {errors.buyer_id && <div className="field-error">{errors.buyer_id}</div>}
            </div>
            <div className="field">
              <label>Volume (MT) *</label>
              <input name="volume_mt" type="number" placeholder="e.g. 120" value={formData.volume_mt || ''} onChange={handleChange} className={errors.volume_mt ? 'err' : ''} />
              {errors.volume_mt && <div className="field-error">{errors.volume_mt}</div>}
            </div>
            <div className="field">
              <label>Price/MT (USD) *</label>
              <input name="price_per_mt_usd" type="number" placeholder="e.g. 1450" value={formData.price_per_mt_usd || ''} onChange={handleChange} className={errors.price_per_mt_usd ? 'err' : ''} />
              {errors.price_per_mt_usd && <div className="field-error">{errors.price_per_mt_usd}</div>}
            </div>
            <div className="field">
              <label>Calculated Contract Value</label>
              <input type="text" value={formData.volume_mt && formData.price_per_mt_usd ? `$${(formData.volume_mt * formData.price_per_mt_usd).toLocaleString()}` : '$0'} readOnly style={{ background: '#F8FAFC' }} />
            </div>
            <div className="field">
              <label>Delivery Point *</label>
              <input name="delivery_point" type="text" placeholder="e.g. Tema Port" value={formData.delivery_point} onChange={handleChange} className={errors.delivery_point ? 'err' : ''} />
              {errors.delivery_point && <div className="field-error">{errors.delivery_point}</div>}
            </div>
            <div className="field">
              <label>Deal Deadline *</label>
              <CustomDatePicker
                name="deadline_date"
                value={formData.deadline_date}
                onChange={handleChange}
                error={!!errors.deadline_date}
              />
              {errors.deadline_date && <div className="field-error">{errors.deadline_date}</div>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: '8px', fontSize: '16px', color: 'var(--text)' }}>
              Upload trade documents
            </div>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px', lineHeight: 1.55 }}>
              These files apply to this trade only. All items marked with * are required before you can submit to Miziba.
              If anything is missing, save your application as a draft and return when ready.
            </p>
            {!currentDraftId ? (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px dashed var(--bdr)',
                  background: '#F9FAFB',
                  marginBottom: '16px',
                }}
              >
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                  Save a draft first so your uploads are stored with this application.
                </p>
                <Button variant="secondary" onClick={handleSaveDraft} disabled={savingDraft}>
                  {savingDraft ? 'Saving draft…' : 'Save draft to enable uploads'}
                </Button>
              </div>
            ) : (
              <TraderDocuments
                draftId={currentDraftId}
                onNotify={onNotify}
                onDocumentsChange={(docs) => {
                  setTradeDocuments(docs);
                  if (hasAllRequiredTradeDocs(docs)) setDocError('');
                }}
              />
            )}
            {!!docError && (
              <div className="field-error" style={{ marginTop: '12px' }}>
                {docError}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="alert alert-info" style={{ marginBottom: '24px', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontWeight: 800, marginBottom: '6px', fontSize: '16px' }}>Minimum Required Equity: 35%</div>
              <p style={{ lineHeight: '1.6' }}>You must contribute at least 35% of procurement cost as your equity. After approval, this amount must be deposited into TradeVault escrow within 5 business days. At settlement, the Finance Partner is repaid first.</p>
            </div>
            <div className="g2 g-compact">
              <div className="field">
                <label>Procurement Cost (USD) *</label>
                <input name="procurement_cost_usd" type="number" value={formData.procurement_cost_usd || ''} onChange={handleChange} className={errors.procurement_cost_usd ? 'err' : ''} />
                {errors.procurement_cost_usd && <div className="field-error">{errors.procurement_cost_usd}</div>}
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>Standard estimate is 80% of contract value.</p>
              </div>
              <div className="field">
                <label>Trader Equity (USD) *</label>
                <input name="trader_equity_usd" type="number" value={formData.trader_equity_usd || ''} onChange={handleChange} className={errors.trader_equity_usd ? 'err' : ''} />
                {errors.trader_equity_usd && <div className="field-error">{errors.trader_equity_usd}</div>}
              </div>
              <div className="field">
                <label>Finance Facility Required (USD) *</label>
                <input name="finance_facility_usd" type="number" value={formData.finance_facility_usd || ''} onChange={handleChange} className={errors.finance_facility_usd ? 'err' : ''} />
                {errors.finance_facility_usd && <div className="field-error">{errors.finance_facility_usd}</div>}
              </div>
              <div className="field">
                <label>Offtaker Payment Terms *</label>
                <CustomSelect
                  name="payment_terms_days"
                  value={formData.payment_terms_days}
                  onChange={handleChange}
                  error={!!errors.payment_terms_days}
                  options={[
                    { label: '30 days', value: 30 },
                    { label: '45 days', value: 45 },
                    { label: '60 days', value: 60 }
                  ]}
                />
                {errors.payment_terms_days && <div className="field-error">{errors.payment_terms_days}</div>}
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>
                  Number of days after delivery for the buyer/offtaker to complete payment.
                </p>
              </div>
            </div>
            <div style={{ marginTop: '20px', fontWeight: 'bold', color: formData.trader_equity_usd && formData.procurement_cost_usd && (formData.trader_equity_usd / formData.procurement_cost_usd < 0.35) ? 'var(--da)' : 'var(--su)' }}>
              Equity Coverage: {formData.trader_equity_usd && formData.procurement_cost_usd ? Math.round((formData.trader_equity_usd / formData.procurement_cost_usd) * 100) : 0}%
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: '16px', fontSize: '16px', color: 'var(--text)' }}>
              Review your application
            </div>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px', lineHeight: 1.5 }}>
              Check the details below. Use <strong>Previous</strong> if anything needs changing.
            </p>

            <div
              style={{
                border: '1px solid var(--bdr, #E5E7EB)',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: '#6B7280',
                  background: '#F9FAFB',
                  borderBottom: '1px solid var(--bdr, #E5E7EB)',
                }}
              >
                1. OFFTAKE CONTRACT
              </div>
              {[
                ['Commodity', formData.commodity ? CMD[formData.commodity]?.l ?? formData.commodity : '—'],
                ['Grade', formData.grade ? `Grade ${formData.grade}` : '—'],
                ['Buyer', buyers.find(b => b.id === formData.buyer_id)?.name ?? '—'],
                ['Volume', formData.volume_mt != null ? `${formData.volume_mt} MT` : '—'],
                ['Price / MT', formData.price_per_mt_usd != null ? `${fmtUsd(formData.price_per_mt_usd)}/MT` : '—'],
                ['Contract value', fmtUsd((formData.volume_mt || 0) * (formData.price_per_mt_usd || 0))],
                ['Delivery point', formData.delivery_point || '—'],
                ['Deal deadline', formData.deadline_date || '—'],
              ].map(([label, val], i) => (
                <div
                  key={String(label)}
                  style={{
                    display: 'flex',
                    padding: '10px 14px',
                    borderBottom: '1px solid #F3F4F6',
                    background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <span style={{ width: '160px', flexShrink: 0, fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: '14px', flex: 1, minWidth: 0, color: '#111827' }}>{val}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                border: '1px solid var(--bdr, #E5E7EB)',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: '#6B7280',
                  background: '#F9FAFB',
                  borderBottom: '1px solid var(--bdr, #E5E7EB)',
                }}
              >
                2. TRADE DOCUMENTS
              </div>
              <div style={{ padding: '12px 14px', fontSize: '13px', color: canSubmitDocuments ? '#065F46' : '#DC2626' }}>
                {canSubmitDocuments
                  ? 'All required trade documents uploaded.'
                  : `${requiredDocsMissing} required document${requiredDocsMissing === 1 ? '' : 's'} still missing — go back to step 2 or save as draft.`}
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--bdr, #E5E7EB)',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: '#6B7280',
                  background: '#F9FAFB',
                  borderBottom: '1px solid var(--bdr, #E5E7EB)',
                }}
              >
                3. EQUITY & TERMS
              </div>
              {[
                ['Procurement cost', fmtUsd(formData.procurement_cost_usd)],
                ['Trader equity', fmtUsd(formData.trader_equity_usd)],
                ['Finance facility required', fmtUsd(formData.finance_facility_usd)],
                [
                  'Offtaker payment terms',
                  formData.payment_terms_days != null ? `${formData.payment_terms_days} days after delivery` : '—',
                ],
              ].map(([label, val], i) => (
                <div
                  key={String(label)}
                  style={{
                    display: 'flex',
                    padding: '10px 14px',
                    borderBottom: '1px solid #F3F4F6',
                    background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <span style={{ width: '160px', flexShrink: 0, fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: '14px', flex: 1, minWidth: 0, color: '#111827' }}>{val}</span>
                </div>
              ))}
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                cursor: 'pointer',
                marginBottom: '20px',
                padding: '14px',
                borderRadius: '10px',
                border: termsError ? '1px solid var(--da-b, #FCA5A5)' : '1px solid var(--bdr, #E5E7EB)',
                background: termsError ? 'var(--da-bg, #FEF2F2)' : '#fff',
                boxShadow: termsError ? '0 0 0 1px rgba(239, 68, 68, 0.08)' : '0 2px 8px rgba(15, 23, 42, 0.04)',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => {
                  const checked = e.target.checked;
                  setTermsAccepted(checked);
                  if (checked) setTermsError('');
                }}
                style={{ marginTop: '3px', width: '18px', height: '18px', flexShrink: 0, accentColor: 'var(--cr)' }}
              />
              <span style={{ fontSize: '13px', lineHeight: 1.55, color: '#374151' }}>
                I confirm that all information above is accurate, my equity commitment is binding, and I have no active
                sanctions or outstanding commodity disputes.
              </span>
            </label>
            {!!termsError && (
              <div className="field-error" style={{ marginTop: '-12px', marginBottom: '16px' }}>
                {termsError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                onClick={handleSubmit}
                disabled={loading || !canSubmitToSystem || !canSubmitDocuments || !currentDraftId}
                title={
                  !canSubmitToSystem
                    ? 'Verify your company before submitting to Miziba'
                    : !canSubmitDocuments
                      ? 'Upload all required trade documents first'
                      : undefined
                }
              >
                {loading
                  ? 'Submitting...'
                  : !canSubmitToSystem
                    ? 'Submit (requires verified KYC)'
                    : !canSubmitDocuments
                      ? 'Submit (requires trade documents)'
                      : 'Submit Application'}
              </Button>
              <Button variant="secondary" onClick={handleSaveDraft} disabled={savingDraft}>
                {savingDraft ? 'Saving...' : currentDraftId ? 'Update Draft' : 'Save as Draft'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-form"
            disabled={step === 1}
            style={{ opacity: step === 1 ? 0.4 : 1, cursor: step === 1 ? 'not-allowed' : 'pointer' }}
            onClick={() => setStep(s => Math.max(1, s - 1))}
          >
            ← Previous
          </button>
        </div>
        {step < 4 && (
          <button
            className="btn btn-primary btn-form"
            onClick={async () => {
              if (!validateStep()) return;
              if (step === 2) {
                setSavingDraft(true);
                try {
                  await ensureDraftExists();
                } catch (err: any) {
                  onNotify(err.message || 'Failed to save draft for document uploads', 'error');
                  return;
                } finally {
                  setSavingDraft(false);
                }
              }
              setStep((s) => Math.min(4, s + 1));
            }}
            disabled={step === 2 && savingDraft}
          >
            {step === 2 && savingDraft ? 'Saving draft…' : 'Next →'}
          </button>
        )}
        {step === 4 && (
          <Button variant="secondary" onClick={handleSaveDraft} disabled={savingDraft}>
            {savingDraft ? 'Saving...' : currentDraftId ? 'Update Draft' : 'Save as Draft'}
          </Button>
        )}
      </div>
    </div>
    </div>
  );
};

export default ApplicationForm;
