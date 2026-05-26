"use client";

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, CustomSelect } from '../ui';
import { usd } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { BuyerRowActionsMenu } from '@/components/admin/BuyerRowActionsMenu';

const INITIAL_FORM = {
  name: '',
  country: '',
  registrationNumber: '',
  credit_rating: 'A',
  notes: '',
  sanctions_clear: true,
};

interface BuyerIntelligenceProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenBuyerEdit: (buyerId: string) => void;
}

const BuyerIntelligence: React.FC<BuyerIntelligenceProps> = ({ onNotify, onOpenBuyerEdit }) => {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [search, setSearch] = useState('');
  const [openMenuBuyerId, setOpenMenuBuyerId] = useState<string | null>(null);

  const filteredBuyers = buyers.filter(b => 
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.country?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    fetchBuyers();
  }, []);

  const fetchBuyers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getBuyers();
      setBuyers(data);
    } catch (err: any) {
      console.error('Failed to fetch buyers', err);
      onNotify(err.message || 'Failed to load buyer database.', 'error');
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
      onNotify('Buyer registered and credit profile initialized.', 'success');
    } catch (err: any) {
      console.error('Failed to add buyer', err);
      onNotify(err.message || 'Failed to register buyer. Please check server logs.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the database?`)) return;
    try {
      await apiClient.deleteBuyer(id);
      onNotify(`${name} removed from buyer database.`, 'success');
      fetchBuyers();
    } catch (err: any) {
      console.error('Failed to delete buyer', err);
      onNotify(err.message || 'Failed to delete buyer.', 'error');
    }
  };

  const handleDeleteFromMenu = (b: { id: string; name: string }) => {
    handleDelete(b.id, b.name);
  };

  if (loading && buyers.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Buyer Credit Database...</div>;
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              margin: 0,
            }}
          >
            Buyer Creditworthiness Database
          </h2>
          <p style={{ fontSize: '12px', color: '#6B7280' }}>Global pool of approved offtakers for trade finance facilities.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search buyers..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ 
                padding: '8px 12px 8px 32px', 
                fontSize: '13px', 
                borderRadius: '8px', 
                border: '1px solid #E5E7EB',
                width: '240px',
                outline: 'none'
              }}
            />
          </div>
          <div className="mono" style={{ fontSize: '11px', color: '#6B7280' }}>TOTAL BUYERS: {filteredBuyers.length}</div>
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
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>BUYER NAME</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>COUNTRY</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>COMPLETED</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>ON-TIME %</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>SANCTIONS</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>CREDIT RATING</th>
              <th style={{ padding: '16px', textAlign: 'right', fontSize: '15px', fontWeight: 700, color: '#475569' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredBuyers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
                  No buyers match your search.
                </td>
              </tr>
            ) : (
            filteredBuyers.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700 }}>{b.name}</div>
                  <div className="mono" style={{ fontSize: '15px', color: '#9CA3AF' }}>{b.id.slice(0, 8)}</div>
                </td>
                <td style={{ padding: '16px', fontSize: '17px', fontWeight: 500 }}>{b.country}</td>
                <td style={{ padding: '16px', fontSize: '17px' }}>{b.trades_completed}</td>
                <td style={{ padding: '16px', fontSize: '17px' }}>
                  <span style={{ color: b.trades_on_time === b.trades_completed ? '#8B0000' : '#D97706', fontWeight: 600 }}>
                    {b.trades_completed > 0 ? Math.round((b.trades_on_time / b.trades_completed) * 100) : 100}%
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <Badge variant={b.sanctions_clear ? 'success' : 'danger'} style={{ fontSize: '15px', padding: '4px 10px' }}>
                    {b.sanctions_clear ? 'CLEARED' : 'FLAGGED'}
                  </Badge>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ 
                    display: 'inline-block', 
                    padding: '4px 10px', 
                    borderRadius: '6px', 
                    background: '#FFF5F5', 
                    color: '#8B0000', 
                    fontWeight: 800,
                    fontSize: '13px',
                    border: '1px solid #FECACA'
                  }}>
                    {b.credit_rating}
                  </div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <BuyerRowActionsMenu
                      isOpen={openMenuBuyerId === b.id}
                      onOpen={() => setOpenMenuBuyerId(b.id)}
                      onClose={() => setOpenMenuBuyerId(null)}
                      onEditProfile={() => onOpenBuyerEdit(b.id)}
                      onDeleteBuyer={() => handleDeleteFromMenu(b)}
                    />
                  </div>
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Approved Buyer" maxWidth="850px">
        <form onSubmit={handleAddBuyer} style={{ padding: '24px' }}>
          <div className="g2 g-compact">
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
          </div>

          <div className="g2 g-compact">
            <div className="field">
              <label>Registration Number (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. REG-123456" 
                value={formData.registrationNumber}
                onChange={e => setFormData({...formData, registrationNumber: e.target.value})}
              />
            </div>
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
          </div>

          <div className="g2 g-compact" style={{ alignItems: 'end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Internal Intelligence Notes</label>
              <textarea 
                placeholder="e.g. Established relationship since 2018, high volume offtaker..." 
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                style={{ minHeight: '80px', resize: 'vertical' }}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Security & Compliance</label>
              <div 
                className="compliance-card"
                style={{ 
                  padding: '16px', 
                  border: `2px solid ${formData.sanctions_clear ? 'var(--cr)' : '#E2E8F0'}`,
                  borderRadius: '14px',
                  background: formData.sanctions_clear ? '#FFF5F5' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  marginTop: '4px',
                  boxShadow: formData.sanctions_clear ? '0 4px 15px rgba(139, 0, 0, 0.08)' : 'none'
                }}
                onClick={() => setFormData({...formData, sanctions_clear: !formData.sanctions_clear})}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: formData.sanctions_clear ? 'var(--cr)' : '#fff',
                  border: `2px solid ${formData.sanctions_clear ? 'var(--cr)' : '#CBD5E1'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                  boxShadow: formData.sanctions_clear ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}>
                  {formData.sanctions_clear && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 800, 
                    color: formData.sanctions_clear ? 'var(--cr)' : '#475569',
                    letterSpacing: '-0.01em'
                  }}>
                    {formData.sanctions_clear ? 'Buyer Sanctions Cleared' : 'Sanctions Verification Pending'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', fontWeight: 500 }}>
                    {formData.sanctions_clear 
                      ? 'Verified against UN/OFAC/EU global watchlists' 
                      : 'Requires manual compliance audit before trade entry'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '32px', display: 'flex', gap: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '24px' }}>
            <Button type="button" variant="secondary" style={{ flex: 1, height: '48px', fontWeight: 700 }} onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" style={{ flex: 2, height: '48px', fontWeight: 800, fontSize: '16px' }} disabled={adding}>
              {adding ? 'Processing...' : 'Register Approved Buyer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BuyerIntelligence;
