"use client";

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../ui';
import { usd } from '@/lib/utils';
import { apiClient } from '@/lib/api';

const BuyerIntelligence: React.FC = () => {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Buyer Credit Database...</div>;
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Buyer Creditworthiness Database</h2>
        <div className="mono" style={{ fontSize: '11px', color: '#6B7280' }}>TOTAL BUYERS: {buyers.length}</div>
      </div>

      <Card style={{ overflow: 'hidden' }}>
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
                <td style={{ padding: '12px 16px' }}>{b.country}</td>
                <td style={{ padding: '12px 16px' }}>{b.trades_completed}</td>
                <td style={{ padding: '12px 16px' }}>
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
      </Card>

      <div style={{ marginTop: '20px' }}>
        <div className="alert alert-info">
          Note: Buyer credit ratings are calculated using dynamic TradeVault transaction history and Miziba performance scores.
        </div>
      </div>
    </div>
  );
};

export default BuyerIntelligence;
