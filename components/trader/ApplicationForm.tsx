"use client";

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { TradeApplicationInput, BuyerProfile } from '@/lib/types';
import { Button, CustomSelect, CustomDatePicker, ConfirmDialog } from '@/components/ui';
import { CMD } from '@/lib/data';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';

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

interface ApplicationFormProps {
  onSuccess: (trade: any) => void;
  onNotify: (msg: string, type?: string) => void;
}

const ApplicationForm: React.FC<ApplicationFormProps> = ({ onSuccess, onNotify }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<Partial<TradeApplicationInput>>(INITIAL_FORM_DATA);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Check if form is dirty by comparing with INITIAL_FORM_DATA
  const isDirty = !isSubmitted && JSON.stringify(formData) !== JSON.stringify(INITIAL_FORM_DATA);

  useNavigationGuard(isDirty);

  useEffect(() => {
    fetchBuyers();
  }, []);

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
        }
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
      if (!formData.deadline_date) e.deadline_date = 'Please set a procurement deadline.';
    }
    if (step === 2) {
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await apiClient.createTrade(formData as TradeApplicationInput);
      setIsSubmitted(true); // Disable the guard
      onNotify('Application submitted successfully!', 'success');
      onSuccess(result);
    } catch (err: any) {
      onNotify(err.message || 'Failed to submit application', 'error');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Offtake Contract', 'Equity & Terms', 'Submit'];

  return (
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
          <div className="g2" style={{ gap: '32px' }}>
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
              <label>Deadline *</label>
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
            <div className="alert alert-info" style={{ marginBottom: '24px', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontWeight: 800, marginBottom: '6px', fontSize: '16px' }}>Minimum Equity: 35%</div>
              <p style={{ lineHeight: '1.6' }}>Minimum 35% of procurement cost as equity into TradeVault escrow within 5 business days of approval. Finance partner is paid first from any proceeds.</p>
            </div>
            <div className="g2" style={{ gap: '32px' }}>
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
                <label>Payment Terms *</label>
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
              </div>
            </div>
            <div style={{ marginTop: '20px', fontWeight: 'bold', color: formData.trader_equity_usd && formData.procurement_cost_usd && (formData.trader_equity_usd / formData.procurement_cost_usd < 0.35) ? 'var(--da)' : 'var(--su)' }}>
                Equity Coverage: {formData.trader_equity_usd && formData.procurement_cost_usd ? Math.round((formData.trader_equity_usd / formData.procurement_cost_usd) * 100) : 0}%
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="alert alert-success" style={{ marginBottom: '24px', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontWeight: 800, marginBottom: '6px', fontSize: '16px' }}>Ready to Submit</div>
              <p style={{ lineHeight: '1.6' }}>By submitting, you confirm all data is accurate, your equity commitment is binding, and you have no active sanctions or outstanding commodity disputes.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #F3F4F6' }}>
        <button 
          className="btn btn-secondary" 
          disabled={step === 1}
          style={{ opacity: step === 1 ? 0.4 : 1, cursor: step === 1 ? 'not-allowed' : 'pointer' }}
          onClick={() => setStep(s => Math.max(1, s - 1))}
        >
          ← Previous
        </button>
        {step < 3 && (
          <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={() => validateStep() && setStep(s => Math.min(3, s + 1))}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
};

export default ApplicationForm;
