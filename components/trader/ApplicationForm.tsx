"use client";

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { TradeApplicationInput, BuyerProfile } from '@/lib/types';
import { Button } from '@/components/ui';

interface ApplicationFormProps {
  onSuccess: (trade: any) => void;
  onNotify: (msg: string, type?: string) => void;
}

const ApplicationForm: React.FC<ApplicationFormProps> = ({ onSuccess, onNotify }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  
  const [formData, setFormData] = useState<Partial<TradeApplicationInput>>({
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
  });

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
    if (step === 1) {
      if (!formData.buyer_id || !formData.volume_mt || !formData.price_per_mt_usd || !formData.delivery_point || !formData.deadline_date) {
        onNotify('Please fill in all required fields.', 'error');
        return false;
      }
    }
    if (step === 2) {
      const equityPct = (formData.trader_equity_usd || 0) / (formData.procurement_cost_usd || 1);
      if (equityPct < 0.35) {
        onNotify('Minimum equity must be 35% of procurement cost.', 'error');
        return false;
      }
      const total = (formData.trader_equity_usd || 0) + (formData.finance_facility_usd || 0);
      if (Math.abs(total - (formData.procurement_cost_usd || 0)) > 10) {
        onNotify('Equity + Facility must equal Procurement Cost.', 'error');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await apiClient.createTrade(formData as TradeApplicationInput);
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
            <div>
              <label>Commodity *</label>
              <select name="commodity" value={formData.commodity} onChange={handleChange}>
                <option value="cashew">Cashew</option>
                <option value="shea">Shea</option>
                <option value="sesame">Sesame</option>
                <option value="sorghum">Sorghum</option>
                <option value="soya">Soya</option>
              </select>
            </div>
            <div>
              <label>Grade *</label>
              <select name="grade" value={formData.grade} onChange={handleChange}>
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
              </select>
            </div>
            <div>
                <label>Buyer *</label>
                <select name="buyer_id" value={formData.buyer_id} onChange={handleChange}>
                    <option value="">Select Buyer</option>
                    {buyers.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.country})</option>
                    ))}
                </select>
            </div>
            <div>
              <label>Volume (MT) *</label>
              <input name="volume_mt" type="number" placeholder="e.g. 120" value={formData.volume_mt || ''} onChange={handleChange} />
            </div>
            <div>
              <label>Price/MT (USD) *</label>
              <input name="price_per_mt_usd" type="number" placeholder="e.g. 1450" value={formData.price_per_mt_usd || ''} onChange={handleChange} />
            </div>
            <div>
              <label>Calculated Contract Value</label>
              <input type="text" value={formData.volume_mt && formData.price_per_mt_usd ? `$${(formData.volume_mt * formData.price_per_mt_usd).toLocaleString()}` : '$0'} readOnly style={{ background: '#F8FAFC' }} />
            </div>
            <div>
              <label>Delivery Point *</label>
              <input name="delivery_point" type="text" placeholder="e.g. Tema Port" value={formData.delivery_point} onChange={handleChange} />
            </div>
            <div>
              <label>Deadline *</label>
              <input name="deadline_date" type="date" value={formData.deadline_date} onChange={handleChange} />
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
              <div>
                <label>Procurement Cost (USD) *</label>
                <input name="procurement_cost_usd" type="number" value={formData.procurement_cost_usd || ''} onChange={handleChange} />
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>Standard estimate is 80% of contract value.</p>
              </div>
              <div>
                <label>Trader Equity (USD) *</label>
                <input name="trader_equity_usd" type="number" value={formData.trader_equity_usd || ''} onChange={handleChange} />
              </div>
              <div>
                <label>Finance Facility Required (USD) *</label>
                <input name="finance_facility_usd" type="number" value={formData.finance_facility_usd || ''} onChange={handleChange} />
              </div>
              <div>
                <label>Payment Terms *</label>
                <select name="payment_terms_days" value={formData.payment_terms_days} onChange={handleChange}>
                  <option value={30}>30 days</option>
                  <option value={45}>45 days</option>
                  <option value={60}>60 days</option>
                </select>
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
