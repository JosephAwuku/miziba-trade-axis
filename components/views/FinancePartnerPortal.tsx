"use client";

import React, { useState, useEffect } from 'react';
import { Trade, View, RiskAssessment } from '@/lib/types';
import { ST as stageConfig } from '@/lib/data';
import { usd, mt } from '@/lib/utils';
import { Card, Badge, Button, ProgressBar } from '../ui';
import { apiClient } from '@/lib/api';

interface FinancePartnerPortalProps {
  trades: Trade[];
  onNotify: (msg: string, type?: string) => void;
  view: string;
}

const FinancePartnerPortal: React.FC<FinancePartnerPortalProps> = ({ trades, onNotify, view: currentView }) => {
  const [subView, setSubView] = useState<'inbox' | 'portfolio' | 'onboarding'>('inbox');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, 'approve' | 'decline'>>({});

  // Synchronize subView with external view if needed, but usually FPs use their own internal nav
  // For this implementation, we'll map the sidebar views to our sub-views
  useEffect(() => {
    if (currentView === 'fp_inbox') setSubView('inbox');
    if (currentView === 'fp_portfolio') setSubView('portfolio');
    if (currentView === 'fp_onboarding') setSubView('onboarding');
  }, [currentView]);

  const forReview = trades.filter(t => t.stage === 'FINANCE_REVIEW');
  const myPortfolio = trades.filter(t => t.fp && t.stage !== 'FINANCE_REVIEW' && t.stage !== 'CLOSED');

  const handleDecision = async (tradeId: string, action: 'approve' | 'decline') => {
    try {
      setLoading(true);
      const nextStage = action === 'approve' ? 'FUNDED' : 'CLOSED';
      await apiClient.updateTrade(tradeId, { stage: nextStage });
      setDecisions(prev => ({ ...prev, [tradeId]: action }));
      onNotify(`Deal ${action === 'approve' ? 'Approved' : 'Declined'} successfully`);
    } catch (err) {
      onNotify(`Failed to record decision`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderInbox = () => {
    if (forReview.length === 0) {
      return (
        <Card style={{ padding: '60px 40px', textAlign: 'center', color: '#9CA3AF' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>◎</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>No deals awaiting decision</div>
          <p style={{ marginTop: '10px', fontSize: '12px' }}>New facility requests will appear here after internal validation.</p>
        </Card>
      );
    }

    return forReview.map(d => {
      const decision = decisions[d.id];
      const riskColor = (d.risk || 0) >= 75 ? '#16A34A' : (d.risk || 0) >= 55 ? '#D97706' : '#DC2626';
      
      // Typical waterfall estimates for FP (simplified)
      const fpReturns = Math.round(d.ff * 1.12); // Principal + 12%
      
      return (
        <Card key={d.id} className="fade-in" style={{ padding: '20px', marginBottom: '16px', borderTop: '4px solid #C9943A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="mono" style={{ fontSize: '14px', fontWeight: 700, color: '#8B0000' }}>{d.id}</span>
                <Badge variant="info">{stageConfig[d.stage]?.l || d.stage}</Badge>
                <Badge style={{ background: `${riskColor}15`, color: riskColor, border: `1px solid ${riskColor}30` }}>
                  RISK: {d.risk || '??'}/100
                </Badge>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>{d.tr} · {d.cmd} Grade {d.gr}</div>
            </div>
            <div style={{ background: '#F1F5F9', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
              Group {d.gr}
            </div>
          </div>

          <div className="g4" style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              ['Facility', usd(d.ff)], ['Contract', usd(d.cv)], 
              ['Volume', mt(d.vol)], ['Buyer', d.buyer],
              ['Country', d.bc], ['Deadline', d.dl]
            ].map((f, i) => (
              <div key={i} style={{ background: '#F8FAFC', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: 600, marginBottom: '2px' }}>{f[0].toUpperCase()}</div>
                <div style={{ fontSize: '11px', fontWeight: 500 }}>{f[1]}</div>
              </div>
            ))}
          </div>

          <Card style={{ background: '#0D1F3C', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8', letterSpacing: '.06em', marginBottom: '10px' }}>WATERFALL SETTLEMENT — TradeVault Enforced</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#C9943A', color: '#0D1F3C', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#C9943A' }}>Finance Partner (You)</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>Principal + fixed return — paid first</div>
                </div>
                <div className="mono" style={{ color: '#C9943A', fontWeight: 700 }}>{usd(fpReturns)}</div>
              </div>
              <div style={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: '10px', padding: '8px' }}>
                 <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#94A3B8', color: '#0D1F3C', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
                 <div style={{ fontSize: '11px', color: '#FFF' }}>Miziba & Trader Residuals</div>
              </div>
            </div>
          </Card>

          {!decision ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button 
                variant="primary" 
                style={{ flex: 1, background: '#16A34A', border: 'none' }}
                onClick={() => handleDecision(d.id, 'approve')}
                disabled={loading}
              >
                ✓ Approve Facility — {usd(d.ff)}
              </Button>
              <Button 
                variant="secondary" 
                style={{ color: '#DC2626', borderColor: '#FECACA' }}
                onClick={() => handleDecision(d.id, 'decline')}
                disabled={loading}
              >
                ✕ Decline
              </Button>
            </div>
          ) : (
            <div className={`alert alert-${decision === 'approve' ? 'success' : 'danger'}`} style={{ marginBottom: 0 }}>
              {decision === 'approve' 
                ? '✓ Facility approved. Escrow instruction sent to TradeVault.' 
                : '✕ Facility declined. Deal Officer has been notified.'}
            </div>
          )}
        </Card>
      );
    });
  };

  const renderPortfolio = () => {
    return (
      <div className="fade-in">
        <div className="g3" style={{ marginBottom: '20px' }}>
          <Card className="metric">
            <div className="metric-label">ACTIVE DEALS</div>
            <div className="metric-val">{myPortfolio.length}</div>
          </Card>
          <Card className="metric">
            <div className="metric-label">CAPITAL DEPLOYED</div>
            <div className="metric-val" style={{ color: '#7C3AED', fontSize: '18px' }}>
              {usd(myPortfolio.reduce((a, t) => a + t.ff, 0))}
            </div>
          </Card>
          <Card className="metric">
            <div className="metric-label">AVG PERFORMANCE</div>
            <div className="metric-val" style={{ color: '#16A34A' }}>100%</div>
          </Card>
        </div>

        {myPortfolio.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>No active portfolio items.</div>}
        
        {myPortfolio.map(d => (
          <Card key={d.id} style={{ padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                  <span className="mono" style={{ fontWeight: 700 }}>{d.id}</span>
                  <Badge variant="info">{stageConfig[d.stage]?.l || d.stage}</Badge>
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>{d.tr} · {d.cmd} · {mt(d.vol)}</div>
             </div>
             <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontWeight: 700 }}>{usd(d.ff)}</div>
                <div style={{ fontSize: '10px', color: '#9CA3AF' }}>Facility</div>
             </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderOnboarding = () => {
    const steps = [
      { n: 1, l: 'Due Diligence on Miziba', desc: "Review Miziba's operations and track record (0% default rate)." },
      { n: 2, l: 'Master Framework Agreement', desc: 'Execution of governs facility terms and waterfall priority.' },
      { n: 3, l: 'Portal Access Setup', desc: 'Nominating reviewers and approvers with 2FA access.' },
      { n: 4, l: 'Escrow Bank Account Setup', desc: 'Registration of swifts and account details for disbursements.' },
      { n: 5, l: 'First Deal Briefing', desc: 'Orientation with Deal Officer on current bridge deal cycles.' }
    ];

    const progress = Math.round(((onboardingStep - 1) / 5) * 100);

    return (
      <div className="fade-in">
        <Card style={{ padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Onboarding Progress</span>
            <span className="mono" style={{ fontWeight: 700 }}>{onboardingStep - 1}/5 Complete</span>
          </div>
          <ProgressBar value={progress} color="#C9943A" height="10px" />
        </Card>

        {steps.map(s => (
          <Card 
            key={s.n} 
            style={{ 
              padding: '16px', 
              marginBottom: '12px', 
              borderLeft: `4px solid ${onboardingStep > s.n ? '#16A34A' : onboardingStep === s.n ? '#C9943A' : '#E5E7EB'}`,
              opacity: onboardingStep < s.n ? 0.6 : 1
            }}
          >
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ 
                width: '28px', height: '28px', borderRadius: '50%', 
                background: onboardingStep > s.n ? '#16A34A' : onboardingStep === s.n ? '#C9943A' : '#E5E7EB',
                color: '#FFF', fontSize: '12px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {onboardingStep > s.n ? '✓' : s.n}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{s.l}</div>
                <p style={{ fontSize: '11px', color: '#6B7280', lineHeight: 1.5 }}>{s.desc}</p>
                {onboardingStep === s.n && (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    style={{ marginTop: '12px', background: '#C9943A', border: 'none' }}
                    onClick={() => {
                        setOnboardingStep(prev => prev + 1);
                        onNotify(`Step ${s.n} completed.`);
                    }}
                  >
                    Complete Step {s.n} →
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Finance Partner Portal</h2>
          <p style={{ fontSize: '11px', color: '#64748B' }}>ECobank DFI Fund · Relationship Manager</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
             <button className={`tab ${subView === 'inbox' ? 'on' : ''}`} style={{ color: subView === 'inbox' ? '#C9943A' : '', borderBottomColor: subView === 'inbox' ? '#C9943A' : '' }} onClick={() => setSubView('inbox')}>Inbox</button>
             <button className={`tab ${subView === 'portfolio' ? 'on' : ''}`} style={{ color: subView === 'portfolio' ? '#C9943A' : '', borderBottomColor: subView === 'portfolio' ? '#C9943A' : '' }} onClick={() => setSubView('portfolio')}>Portfolio</button>
             <button className={`tab ${subView === 'onboarding' ? 'on' : ''}`} style={{ color: subView === 'onboarding' ? '#C9943A' : '', borderBottomColor: subView === 'onboarding' ? '#C9943A' : '' }} onClick={() => setSubView('onboarding')}>Onboarding</button>
        </div>
      </div>

      <div className="content-area">
        {subView === 'inbox' && renderInbox()}
        {subView === 'portfolio' && renderPortfolio()}
        {subView === 'onboarding' && renderOnboarding()}
      </div>
    </div>
  );
};

export default FinancePartnerPortal;
