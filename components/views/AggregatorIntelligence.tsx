"use client";

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, CustomSelect } from '../ui';
import { apiClient } from '@/lib/api';
import { AggregatorRowActionsMenu } from '@/components/admin/AggregatorRowActionsMenu';

const INITIAL_FORM = {
  name: '',
  country: '',
  registrationNumber: '',
  credit_rating: 'A',
  notes: '',
  sanctions_clear: true,
};

interface AggregatorIntelligenceProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenAggregatorEdit: (aggregatorId: string) => void;
}

const AggregatorIntelligence: React.FC<AggregatorIntelligenceProps> = ({ onNotify, onOpenAggregatorEdit }) => {
  const [aggregators, setAggregators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [search, setSearch] = useState('');
  const [openMenuAggregatorId, setOpenMenuAggregatorId] = useState<string | null>(null);

  const filteredAggregators = aggregators.filter(a => 
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.country?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    fetchAggregators();
  }, []);

  const fetchAggregators = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAggregators();
      setAggregators(data);
    } catch (err: any) {
      console.error('Failed to fetch aggregators', err);
      onNotify(err.message || 'Failed to load aggregator database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAggregator = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await apiClient.addAggregator(formData);
      setShowModal(false);
      setFormData(INITIAL_FORM);
      fetchAggregators();
      onNotify('Aggregator registered and credit profile initialized.', 'success');
    } catch (err: any) {
      console.error('Failed to add aggregator', err);
      onNotify(err.message || 'Failed to register aggregator. Please check server logs.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the database?`)) return;
    try {
      await apiClient.deleteAggregator(id);
      onNotify(`${name} removed from aggregator database.`, 'success');
      fetchAggregators();
    } catch (err: any) {
      console.error('Failed to delete aggregator', err);
      onNotify(err.message || 'Failed to delete aggregator.', 'error');
    }
  };

  const handleDeleteFromMenu = (a: { id: string; name: string }) => {
    handleDelete(a.id, a.name);
  };

  if (loading && aggregators.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Aggregator Database...</div>;
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
            Aggregator Database
          </h2>
          <p style={{ fontSize: '12px', color: '#6B7280' }}>Network of aggregators for trade sourcing and supply chain operations.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search aggregators..." 
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
          <div className="mono" style={{ fontSize: '11px', color: '#6B7280' }}>TOTAL AGGREGATORS: {filteredAggregators.length}</div>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            + Add New Aggregator
          </Button>
        </div>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>AGGREGATOR NAME</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>COUNTRY</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>COMPLETED</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>ON-TIME %</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>SANCTIONS</th>
              <th style={{ padding: '16px', textAlign: 'left', fontSize: '15px', fontWeight: 700, color: '#475569' }}>CREDIT RATING</th>
              <th style={{ padding: '16px', textAlign: 'right', fontSize: '15px', fontWeight: 700, color: '#475569' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredAggregators.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
                  No aggregators match your search.
                </td>
              </tr>
            ) : (
            filteredAggregators.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700 }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: '15px', color: '#9CA3AF' }}>{a.id.slice(0, 8)}</div>
                </td>
                <td style={{ padding: '16px', fontSize: '17px', fontWeight: 500 }}>{a.country}</td>
                <td style={{ padding: '16px', fontSize: '17px' }}>{a.trades_completed}</td>
                <td style={{ padding: '16px', fontSize: '17px' }}>
                  <span style={{ color: a.trades_on_time === a.trades_completed ? '#8B0000' : '#D97706', fontWeight: 600 }}>
                    {a.trades_completed > 0 ? Math.round((a.trades_on_time / a.trades_completed) * 100) : 100}%
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <Badge variant={a.sanctions_clear ? 'success' : 'danger'} style={{ fontSize: '15px', padding: '4px 10px' }}>
                    {a.sanctions_clear ? 'CLEARED' : 'FLAGGED'}
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
                    {a.credit_rating}
                  </div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <AggregatorRowActionsMenu
                      isOpen={openMenuAggregatorId === a.id}
                      onOpen={() => setOpenMenuAggregatorId(a.id)}
                      onClose={() => setOpenMenuAggregatorId(null)}
                      onEditProfile={() => onOpenAggregatorEdit(a.id)}
                      onDeleteAggregator={() => handleDeleteFromMenu(a)}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Aggregator">
        <form onSubmit={handleAddAggregator}>
          <div className="g2" style={{ marginBottom: '20px' }}>
            <div className="field">
              <label>Aggregator name *</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required 
              />
            </div>
            <div className="field">
              <label>Country *</label>
              <input 
                type="text" 
                value={formData.country} 
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                required 
              />
            </div>
            <div className="field">
              <label>Registration number</label>
              <input 
                type="text" 
                value={formData.registrationNumber} 
                onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Credit rating *</label>
              <CustomSelect 
                name="credit_rating"
                value={formData.credit_rating}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, credit_rating: e.target.value })}
                options={[
                  { label: 'AAA (Excellent)', value: 'AAA' },
                  { label: 'AA (Very Good)', value: 'AA' },
                  { label: 'A (Good)', value: 'A' },
                  { label: 'BBB (Adequate)', value: 'BBB' },
                  { label: 'BB (Marginal)', value: 'BB' }
                ]}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: '20px' }}>
            <label>
              <input 
                type="checkbox" 
                checked={formData.sanctions_clear}
                onChange={(e) => setFormData({ ...formData, sanctions_clear: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              Sanctions clear (OFAC / UN)
            </label>
          </div>
          <div className="field" style={{ marginBottom: '24px' }}>
            <label>Notes (internal only)</label>
            <textarea 
              value={formData.notes} 
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--bdr)', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={adding}>
              {adding ? 'Adding...' : 'Add Aggregator'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AggregatorIntelligence;
