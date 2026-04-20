"use client";

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, ProgressBar } from '../ui';
import { usd } from '@/lib/utils';
import { apiClient } from '@/lib/api';

const FinancePartnerCRM: React.FC = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      // We'll use a new apiClient method
      const res = await fetch('/api/portfolio/partners');
      const data = await res.json();
      setPartners(data.partners || []);
    } catch (err) {
      console.error('Failed to fetch partners', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Finance Partner Database...</div>;
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827' }}>Finance Partner CRM</h2>
          <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>Manage capital provider relationships and liquidity deployment.</p>
        </div>
        <Button variant="primary" onClick={() => {}}>+ Invite Partner</Button>
      </div>

      <div className="g2" style={{ marginBottom: '20px' }}>
        <Card className="metric">
          <div className="metric-label">TOTAL LIQUIDITY ACCESSED</div>
          <div className="metric-val">
            {usd(partners.reduce((a, b) => a + (b.total_deployed || 0), 0))}
          </div>
        </Card>
        <Card className="metric">
          <div className="metric-label">ACTIVE PARTNERS</div>
          <div className="metric-val">{partners.length}</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {partners.map((p) => {
          const utilization = Math.round((p.total_deployed / p.committed_capital) * 100);
          const onb = p.onboarding_step || 1;
          
          return (
            <Card key={p.id} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginTop: '2px' }}>ID: {p.id.slice(0, 8)}</div>
                </div>
                {onb > 5 ? (
                  <Badge variant="success">✓ ACTIVE</Badge>
                ) : (
                  <Badge variant="warning">ONBOARDING: {onb}/5</Badge>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Liquidity Utilization</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{utilization}%</span>
                </div>
                <ProgressBar value={utilization} color="#C9943A" height="8px" />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px' }}>
                  <span style={{ fontWeight: 600 }}>{usd(p.total_deployed)} Deployed</span>
                  <span style={{ color: '#9CA3AF' }}>Limit: {usd(p.committed_capital)}</span>
                </div>
              </div>

              <div className="g2" style={{ gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: 700 }}>DEALS FUNDED</div>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 700 }}>{p.trade_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: 700 }}>AVG RETURN</div>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: '#16A34A' }}>12.4%</div>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <Button variant="secondary" size="sm" style={{ flex: 1 }}>View Portfolio</Button>
                <Button variant="ghost" size="sm">Manage Settings</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default FinancePartnerCRM;
