"use client";

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, CustomSelect } from '../ui';
import { usd } from '@/lib/utils';
import { apiClient } from '@/lib/api';

const INITIAL_FORM = {
  name: '',
  country: '',
  credit_rating: 'A',
  sanctions_clear: true,
};

const BuyerIntelligence: React.FC = () => {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  useEffect(() => {
    fetchBuyers();
  }, []);

  const fetchBuyers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getBuyers();
      setBuyers(data);
    } catch (err) {
      console.error('Failed to fetch buyers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await apiClient.addBuyer(formData);
      setShowModal(false);
      setFormData(INITIAL_FORM);
      fetchBuyers();
    } catch (err) {
      console.error('Failed to add buyer', err);
    } finally {
      setAdding(false);
    }
  };

  if (loading && buyers.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Buyer Credit Database...</div>;
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Buyer Creditworthiness Database</h2>
          <p style={{ fontSize: '12px', color: '#6B7280' }}>Global pool of approved offtakers for trade finance facilities.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="mono" style={{ fontSize: '11px', color: '#6B7280' }}>TOTAL BUYERS: {buyers.length}</div>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            + Add New Buyer
          </Button>
        </div>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>BUYER NAME</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>COUNTRY</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>COMPLETED</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>ON-TIME %</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>SANCTIONS</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>CREDIT RATING</th>
            </tr>
          </thead>
          <tbody>
            {buyers.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.name}</div>
                  <div className="mono" style={{ fontSize: '9px', color: '#9CA3AF' }}>{b.id.slice(0, 8)}</div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px' }}>{b.country}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px' }}>{b.trades_completed}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                  <span style={{ color: b.trades_on_time === b.trades_completed ? '#16A34A' : '#D97706' }}>
                    {b.trades_completed > 0 ? Math.round((b.trades_on_time / b.trades_completed) * 100) : 100}%
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge variant={b.sanctions_clear ? 'success' : 'danger'}>
                    {b.sanctions_clear ? 'CLEARED' : 'FLAGGED'}
                  </Badge>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ 
                    display: 'inline-block', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    background: '#F0F9FF', 
                    color: '#0369A1', 
                    fontWeight: 700,
                    fontSize: '11px',
                    border: '1px solid #BAE6FD'
                  }}>
                    {b.credit_rating}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>

      <div style={{ marginTop: '20px' }}>
        <div className="alert alert-info">
          Note: Buyer credit ratings are calculated using dynamic TradeVault transaction history and Miziba performance scores.
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Approved Buyer">
        <form onSubmit={handleAddBuyer} style={{ padding: '20px' }}>
          <div className="field">
            <label>Legal Company Name</label>
            <input 
              type="text" 
              placeholder="e.g. Global Agri Corp" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div className="field">
            <label>Registered Country</label>
            <input 
              type="text" 
              placeholder="e.g. Vietnam, India, USA" 
              value={formData.country}
              onChange={e => setFormData({...formData, country: e.target.value})}
              required
            />
          </div>
          <div className="g2">
            <div className="field">
              <label>Initial Credit Rating</label>
              <CustomSelect 
                name="credit_rating"
                value={formData.credit_rating}
                onChange={e => setFormData({...formData, credit_rating: e.target.value})}
                options={[
                  { label: 'AAA - Exceptional', value: 'AAA' },
                  { label: 'AA - High Quality', value: 'AA' },
                  { label: 'A - Reliable', value: 'A' },
                  { label: 'BBB - Investment Grade', value: 'BBB' },
                  { label: 'BB - Speculative', value: 'BB' },
                ]}
              />
            </div>
            <div className="field">
              <label>Sanctions Clearance</label>
              <div 
                style={{ 
                  padding: '12px', 
                  border: '2px solid transparent',
                  backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer'
                }}
                onClick={() => setFormData({...formData, sanctions_clear: !formData.sanctions_clear})}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  background: formData.sanctions_clear ? 'var(--su)' : '#E5E7EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '12px'
                }}>
                  {formData.sanctions_clear && '✓'}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: formData.sanctions_clear ? 'var(--su)' : '#6B7280' }}>
                  {formData.sanctions_clear ? 'Sanctions Cleared' : 'Sanctions Pending'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <Button type="button" variant="secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" style={{ flex: 2 }} disabled={adding}>
              {adding ? 'Processing...' : 'Register Buyer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BuyerIntelligence;
