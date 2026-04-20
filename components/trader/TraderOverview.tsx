"use client";

import React from 'react';
import { Card, Button, Badge } from '../ui';
import { usd } from '@/lib/utils';
import { Trade } from '@/lib/types';

interface TraderOverviewProps {
  trades: Trade[];
  onNavigate: (view: string) => void;
  onNotify: (msg: string, type?: string) => void;
}

const TraderOverview: React.FC<TraderOverviewProps> = ({ trades, onNavigate, onNotify }) => {
  // Mock verification status - normally this would come from the user's profile
  const isVerified = false; 

  const activeTrades = trades.filter(t => t.stage !== 'CLOSED' && t.stage !== 'SETTLED');
  const totalValue = activeTrades.reduce((sum, t) => sum + (t.cv || 0), 0);
  const totalFacility = activeTrades.reduce((sum, t) => sum + (t.ff || 0), 0);

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>Welcome back, Wenchi Cashew Alliance</h2>
        <p style={{ fontSize: '14px', color: 'var(--text2)' }}>Here is a summary of your recent trades and account status.</p>
      </div>

      {/* High Priority Onboarding Banner */}
      {!isVerified && (
        <Card style={{ 
          padding: '28px', 
          marginBottom: '32px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
          border: '2px solid transparent',
          backgroundImage: 'linear-gradient(#FFF9F9, #FFF9F9), linear-gradient(135deg, var(--cr), var(--pu))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
                Your path to trade finance starts with verification
              </h3>
              <div style={{ fontSize: '14.5px', color: 'var(--text2)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <p>To begin submitting trades and getting funding, you must first complete your business profile.</p>
                <p>This secure, one-time verification ensures your business is ready to trade internationally.</p>
              </div>
            </div>
            <Button 
                style={{ 
                  background: '#8B0000', 
                  color: '#fff', 
                  fontWeight: 700, 
                  padding: '14px 36px', 
                  fontSize: '14.5px',
                  boxShadow: '0 2px 4px rgba(139, 0, 0, 0.2)'
                }}
                onClick={() => onNavigate('verify')}
            >
              Start Verification Now →
            </Button>
          </div>
        </Card>
      )}

      {/* Metrics Row */}
      <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <Card style={{ padding: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px' }}>ACTIVE APPLICATIONS</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{activeTrades.length}</div>
          <div style={{ fontSize: '12.5px', color: '#16A34A', marginTop: '6px', fontWeight: 600 }}>✓ Processing normally</div>
        </Card>
        <Card style={{ padding: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px' }}>TOTAL CONTRACT VALUE</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{usd(totalValue)}</div>
          <p style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '6px' }}>Across all active seasons</p>
        </Card>
        <Card style={{ padding: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px' }}>APPROVED FUNDING</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--cr)' }}>{usd(totalFacility)}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '6px' }}>Funds ready to use</div>
        </Card>
      </div>

      {/* Recent Activity / Status Shortcut */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Your Recent Trades</h3>
            <Button variant="secondary" size="md" onClick={() => onNavigate('status')}>View All Trades</Button>
          </div>
          
          {activeTrades.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text2)' }}>
                <p style={{ marginBottom: '20px', fontSize: '15px' }}>You haven&apos;t started any trade applications yet.</p>
                <Button 
                  variant="primary" 
                  style={{ 
                    padding: '12px 32px', 
                    fontSize: '15px', 
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(139, 0, 0, 0.2)' 
                  }} 
                  onClick={() => onNavigate('apply')}
                >
                  Submit New Trade Application
                </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeTrades.slice(0, 3).map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #F1F5F9', borderRadius: '8px' }}>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{t.cmd} · {t.vol} MT</div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{t.buyer} · {t.id}</div>
                        </div>
                        <Badge variant="info">{t.stage}</Badge>
                    </div>
                ))}
            </div>
          )}
        </Card>

        <Card style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>Help & Resources</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Guide: Cashew Grading</div>
                <p style={{ fontSize: '12.5px', color: 'var(--text2)' }}>Learn how to grade cashews for Grade A status.</p>
            </div>
            <div style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Settlement Timelines</div>
                <p style={{ fontSize: '12.5px', color: 'var(--text2)' }}>Standard 30-60 day payment steps explained.</p>
            </div>
            <div style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Contact Deal Officer</div>
                <p style={{ fontSize: '12.5px', color: 'var(--text2)' }}>Request assistance with an active deal.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TraderOverview;
