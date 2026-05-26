"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import { usd } from '@/lib/utils';
import { Trade } from '@/lib/types';
import { commodityLabel } from '@/lib/data';
import StageBadge from './StageBadge';
import { sumFacilityByDeployment, isDeployedTradeStage } from '@/lib/portfolio-metrics';
import { apiClient } from '@/lib/api';

interface TraderOverviewProps {
  trades: Trade[];
  onNavigate: (view: string) => void;
  onSelectTrade: (id: string) => void;
  onNotify: (msg: string, type?: string) => void;
}

const TraderOverview: React.FC<TraderOverviewProps> = ({ trades, onNavigate, onSelectTrade, onNotify }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await apiClient.getTraderProfile();
        setProfile(data);
      } catch (err) {
        console.error('Failed to fetch dashboard profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const kycStatus = profile?.kyc_status || 'PENDING';
  const isVerified = profile?.is_fully_verified === true || profile?.can_submit_trades === true;
  const showKycBanner = profile && (kycStatus === 'PENDING' || kycStatus === 'REJECTED' || kycStatus === 'FLAGGED');
  const showUnderReviewBanner = profile && kycStatus === 'UNDER_REVIEW';
  const companyName = profile?.name || '...';

  const handleApplyClick = () => {
    if (!isVerified) {
      onNotify(
        kycStatus === 'UNDER_REVIEW'
          ? 'Verification in progress — you can prepare a trade and save it as a draft until approved.'
          : 'You can start a trade application and save drafts. Submit to Miziba after company verification is approved.',
        'info'
      );
    }
    onNavigate('apply');
  };

  const activeTrades = trades.filter(t => t.stage !== 'CLOSED' && t.stage !== 'SETTLED');
  const totalValue = activeTrades.reduce((sum, t) => sum + (t.cv || 0), 0);
  const approvedFunding = sumFacilityByDeployment(activeTrades, true);
  const fundedTradeCount = activeTrades.filter(t => isDeployedTradeStage(t.stage)).length;

  return (
    <div className="fade-in" style={{ width: '100%', maxWidth: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>Welcome back, {companyName}</h2>
        <p style={{ fontSize: '14px', color: 'var(--text2)' }}>Here is a summary of your recent trades and account status.</p>
      </div>

      {showUnderReviewBanner && (
        <Card className="fade-in" style={{ marginBottom: '32px', border: '1px solid #BFDBFE', background: '#EFF6FF' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>Verification in progress</h3>
          <p style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Your KYC is with our compliance team. Trade applications will unlock once your company is verified (usually 24–48 hours).
          </p>
        </Card>
      )}

      {/* High Priority Onboarding Banner - Intelligent Visibility */}
      {showKycBanner && (
        <Card className="fade-in" style={{ 
          marginBottom: '32px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
          border: '2px solid transparent',
          backgroundImage: 'linear-gradient(#FFF9F9, #FFF9F9), linear-gradient(135deg, var(--cr), var(--pu))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box'
        }}>
          <div className="flex-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
                Your path to trade finance starts with verification
              </h3>
              <div style={{ fontSize: '14.5px', color: 'var(--text2)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <p>
                {kycStatus === 'REJECTED'
                  ? 'Your verification was not approved. Update your documents and resubmit for review.'
                  : 'To begin submitting trades and getting funding, you must first complete your business profile.'}
              </p>
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
                onClick={() => onNavigate('company')}
            >
              Start Company Profile →
            </Button>
          </div>
        </Card>
      )}

      {/* Metrics Row */}
      <div className="g3" style={{ marginBottom: '32px' }}>
        <Card
          style={{ 
            cursor: 'pointer', 
            transition: 'all 0.2s',
            border: '1.5px solid transparent',
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
          }}
          onClick={() => onNavigate('status')}
        >
          <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span>ACTIVE APPLICATIONS</span>
            <span style={{ color: 'var(--cr)', fontSize: '11px' }}>VIEW ALL →</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{activeTrades.length}</div>
          <div style={{ fontSize: '12.5px', color: '#8B0000', marginTop: '6px', fontWeight: 600 }}>✓ Processing normally</div>
        </Card>
        <Card
          style={{
            border: '1.5px solid transparent',
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
          }}
        >
          <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px' }}>TOTAL CONTRACT VALUE</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{usd(totalValue)}</div>
          <p style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '6px' }}>Across all active seasons</p>
        </Card>
        <Card
          style={{ 
            cursor: 'pointer', 
            transition: 'all 0.2s',
            border: '1.5px solid transparent',
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
          }}
          onClick={() => onNavigate('status')}
        >
          <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span>APPROVED FUNDING</span>
            <span style={{ color: 'var(--cr)', fontSize: '11px' }}>DETAILS →</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--cr)' }}>{usd(approvedFunding)}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '6px' }}>
            {fundedTradeCount > 0
              ? `Across ${fundedTradeCount} funded trade${fundedTradeCount === 1 ? '' : 's'}`
              : 'No funding approved yet'}
          </div>
        </Card>
      </div>

      {/* Recent Activity / Status Shortcut */}
      <div className="g2-responsive">
        <Card
          style={{
            border: '1.5px solid transparent',
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
          }}
        >
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Your Recent Trades</h3>
            <Button variant="secondary" size="md" onClick={() => onNavigate('status')}>View All Trades</Button>
          </div>

          {activeTrades.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text2)' }}>
              <p style={{ marginBottom: '20px', fontSize: '15px' }}>You haven&apos;t started any trade applications yet.</p>
              <Button
                variant="primary"
                style={{
                  padding: '12px 32px',
                  fontSize: '15px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(139, 0, 0, 0.2)',
                }}
                onClick={handleApplyClick}
              >
                Add New Trade Application
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeTrades.slice(0, 3).map(t => (
                <div
                  key={t.id}
                  onClick={() => {
                    onNavigate('status');
                    onSelectTrade(t.id);
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    border: '1.5px solid transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                    backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{commodityLabel(t.cmd)} · {t.vol} MT</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{t.buyer} · <span className="mono">{t.id.slice(0, 8)}</span></div>
                  </div>
                  <StageBadge stage={t.stage} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          style={{
            border: '1.5px solid transparent',
            backgroundImage: 'linear-gradient(#fff, #fff), linear-gradient(135deg, var(--cr), var(--pu))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
          }}
        >
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
