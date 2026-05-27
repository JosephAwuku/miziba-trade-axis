"use client";

import React, { useState, useEffect } from 'react';
import { Trade, View, RiskAssessment } from '@/lib/types';
import { ST as stageConfig, commodityLabel } from '@/lib/data';
import { usd, mt } from '@/lib/utils';
import { sumFacilityByDeployment } from '@/lib/portfolio-metrics';
import { Card, Badge, Button, ProgressBar } from '../ui';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/api-errors';

interface FinancePartnerPortalProps {
  trades: Trade[];
  onNotify: (msg: string, type?: string) => void;
  view: View;
  setView: (view: View) => void;
  onRefresh?: () => void;
}

const FinancePartnerPortal: React.FC<FinancePartnerPortalProps> = ({
  trades,
  onNotify,
  view: currentView,
  setView,
  onRefresh,
}) => {
  const [subView, setSubView] = useState<'inbox' | 'overview' | 'portfolio' | 'onboarding' | 'reports'>('overview');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [savingStep, setSavingStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, 'approve' | 'decline' | 'info_request'>>({});
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [activeReviewTradeId, setActiveReviewTradeId] = useState<string | null>(null);

  // Onboarding form state
  const [reviewerName, setReviewerName] = useState('');
  const [approverName, setApproverName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankSwift, setBankSwift] = useState('');
  const [briefingDate, setBriefingDate] = useState<string | null>(null);

  // Load persisted onboarding state from the database on mount
  useEffect(() => {
    apiClient.getFpOnboarding()
      .then((data) => {
        setOnboardingDone(!!data.onboarding_done);
        setOnboardingStep(data.onboarding_done ? 6 : (data.onboarding_step ?? 1));
        setReviewerName(data.reviewer_name ?? '');
        setApproverName(data.approver_name ?? '');
        setBankName(data.bank_name ?? '');
        setBankSwift(data.bank_swift ?? '');
        setBriefingDate(data.next_interaction ?? null);
      })
      .catch(() => {
        // Non-fatal: fall back to step 1 in the UI
      })
      .finally(() => setOnboardingLoading(false));
  }, []);

  // Synchronize subView with external view if needed, but usually FPs use their own internal nav
  // For this implementation, we'll map the sidebar views to our sub-views
  useEffect(() => {
    if (currentView === 'fp_overview') setSubView('overview');
    if (currentView === 'fp_inbox') setSubView('inbox');
    if (currentView === 'fp_portfolio') setSubView('portfolio');
    if (currentView === 'fp_onboarding') setSubView('onboarding');
    if (currentView === 'fp_reports') setSubView('reports');
  }, [currentView]);

  const forReview = trades.filter(t => t.stage === 'FINANCE_REVIEW');
  const myPortfolio = trades.filter(t => t.fp && t.stage !== 'FINANCE_REVIEW' && t.stage !== 'CLOSED');
  const canReviewDeals = onboardingDone && !onboardingLoading;

  const renderOnboardingGate = (title: string) => (
    <Card style={{ padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
      <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: 'var(--text2)', maxWidth: '480px', margin: '0 auto 24px', lineHeight: 1.6 }}>
        Complete all five onboarding steps (framework agreement, portal users, escrow bank details, and briefing)
        before you can approve or decline facility requests.
      </p>
      <Button variant="primary" style={{ background: '#8B0000', border: 'none' }} onClick={() => setView('fp_onboarding')}>
        Continue onboarding →
      </Button>
    </Card>
  );

  useEffect(() => {
    forReview.forEach((t) => {
      apiClient
        .getFpDecisions(t.id)
        .then((res) => {
          const d = res.decisions?.[0];
          if (d?.decision) {
            setDecisions((prev) => ({ ...prev, [t.id]: d.decision as 'approve' | 'decline' | 'info_request' }));
          }
        })
        .catch(() => {});
    });
  }, [forReview.map((t) => t.id).join(',')]);

  const handleDecision = async (tradeId: string, action: 'approve' | 'decline') => {
    try {
      setLoading(true);
      const notes = decisionNotes[tradeId]?.trim();
      const res = await apiClient.submitFpDecision(tradeId, {
        decision: action,
        notes: notes || undefined,
      });
      setDecisions((prev) => ({ ...prev, [tradeId]: action }));
      onNotify(res.message);
      onRefresh?.();
    } catch (err) {
      onNotify(isApiError(err) ? err.message : 'Failed to record decision', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderInbox = () => {
    if (!canReviewDeals) {
      return renderOnboardingGate('Facility decisions locked');
    }
    if (forReview.length === 0) {
      return (
        <Card style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ marginBottom: '20px', color: 'var(--text3)', display: 'flex', justifyContent: 'center' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>No deals awaiting decision</div>
          <p style={{ marginTop: '10px', fontSize: '15px', color: 'var(--text2)' }}>New facility requests will appear here after internal validation.</p>
        </Card>
      );
    }

    if (!activeReviewTradeId) {
      return (
        <Card style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px', color: 'var(--text)' }}>
            Pending Facility Requests
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {forReview.map(d => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                    {commodityLabel(d.cmd)} - {d.vol} MT
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text3)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span>ID: <span className="mono">{d.id.slice(0, 8)}</span></span>
                    <span>Buyer: {d.buyer}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Badge variant="info">{stageConfig[d.stage]?.l || d.stage}</Badge>
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700 }}
                    onClick={() => setActiveReviewTradeId(d.id)}
                  >
                    Review Request →
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      );
    }

    const selectedTrade = forReview.find(t => t.id === activeReviewTradeId);
    if (!selectedTrade) return null;

    return (
      <div className="fade-in">
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setActiveReviewTradeId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--cr)',
              fontSize: '13px',
              fontWeight: 800,
              padding: '4px 0',
              letterSpacing: '0.02em'
            }}
          >
            ← BACK TO REQUESTS
          </button>
        </div>
        {(() => {
      const d = selectedTrade;
      const decision = decisions[d.id];
      const riskColor = (d.risk || 0) >= 75 ? '#8B0000' : (d.risk || 0) >= 55 ? '#D97706' : '#DC2626';

      // Typical waterfall estimates for FP (simplified)
      const fpReturns = Math.round(d.ff * 1.12); // Principal + 12%

      return (
        <Card key={d.id} className="fade-in" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="mono" style={{ fontSize: '14px', fontWeight: 700, color: '#8B0000' }}>{d.id}</span>
                <Badge variant="info">{stageConfig[d.stage]?.l || d.stage}</Badge>
                <Badge style={{ background: `${riskColor}15`, color: riskColor, border: `1px solid ${riskColor}30` }}>
                  RISK: {d.risk || '??'}/100
                </Badge>
              </div>
              <div style={{ fontSize: '14.5px', color: '#64748B' }}>{d.tr} · {commodityLabel(d.cmd)} Grade {d.gr}</div>
            </div>
          </div>

          <div className="g4" style={{ marginBottom: '16px' }}>
            {[
              ['Facility', usd(d.ff)], ['Contract', usd(d.cv)],
              ['Volume', mt(d.vol)], ['Buyer', d.buyer],
              ['Country', d.bc], ['Deadline', d.dl]
            ].map((f, i) => (
              <div key={i} style={{ background: '#F8FAFC', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 700, marginBottom: '3px' }}>{f[0].toUpperCase()}</div>
                <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{f[1]}</div>
              </div>
            ))}
          </div>

          <Card
            style={{
              padding: '18px',
              marginBottom: '16px',
              borderRadius: '14px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em', marginBottom: '14px' }}>
              WATERFALL SETTLEMENT - TradeVault Enforced
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8FAFC', border: '1px solid #E5E7EB', padding: '12px', borderRadius: '10px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--cr-bg)', color: 'var(--cr)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Finance Partner (You)</div>
                  <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Principal + fixed return - paid first</div>
                </div>
                <div className="mono" style={{ color: 'var(--cr)', fontWeight: 800, fontSize: '28px' }}>{usd(fpReturns)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '10px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
                <div style={{ fontSize: '15px', color: 'var(--text2)' }}>Miziba & Trader Residuals</div>
              </div>
            </div>
          </Card>

          {!decision ? (
            <>
              <textarea
                value={decisionNotes[d.id] || ''}
                onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                placeholder="Notes (optional for approve; recommended for decline)"
                style={{
                  width: '100%',
                  minHeight: '64px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  fontSize: '13px',
                  marginTop: '16px',
                  marginBottom: '16px',
                }}
              />
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  style={{ minWidth: '280px', background: '#8B0000', border: 'none' }}
                  onClick={() => handleDecision(d.id, 'approve')}
                  disabled={loading || !canReviewDeals}
                >
                  ✓ Approve Facility — {usd(d.ff)}
                </Button>
                <Button
                  variant="secondary"
                  style={{ minWidth: '200px', color: '#DC2626', borderColor: '#FECACA' }}
                  onClick={() => handleDecision(d.id, 'decline')}
                  disabled={loading || !canReviewDeals}
                >
                  ✕ Decline
                </Button>
              </div>
            </>
          ) : (
            <div className={`alert alert-${decision === 'approve' ? 'success' : 'danger'}`} style={{ marginBottom: 0, marginTop: '16px' }}>
              {decision === 'approve'
                ? '✓ Facility approved. Trade advances to FUNDED when all requirements are met.'
                : '✕ Facility declined. Deal Officer has been notified.'}
            </div>
          )}
        </Card>
      );
    })()}
      </div>
    );
  };

  const renderOverview = () => {
    return (
      <div className="fade-in">
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>Welcome back, Ecobank DFI Fund</h2>
          <p style={{ fontSize: '14px', color: 'var(--text2)' }}>Here is a summary of your active facilities and capital deployed.</p>
        </div>

        {/* High Priority Onboarding Banner */}
        {!onboardingDone && onboardingStep <= 5 && (
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
                  Complete your Partner Onboarding
                </h3>
                <div style={{ fontSize: '14.5px', color: 'var(--text2)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p>To begin reviewing and approving facility requests, you must finish your setup.</p>
                  <p>Escrow accounts and portal access must be finalized.</p>
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
                  onClick={() => setView('fp_onboarding')}
              >
                Continue Onboarding →
              </Button>
            </div>
          </Card>
        )}

        {/* Metrics Row */}
        <div className="g4" style={{ marginBottom: '32px' }}>
          <Card>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px' }}>ACTIVE DEALS</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{myPortfolio.length}</div>
            <div style={{ fontSize: '12.5px', color: '#8B0000', marginTop: '6px', fontWeight: 600 }}>✓ Performing normally</div>
          </Card>
          <Card>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px' }}>FINANCE FACILITY (PIPELINE)</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>
              {usd(forReview.reduce((a, t) => a + t.ff, 0))}
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '6px' }}>{forReview.length} pending your approval</p>
          </Card>
          <Card>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px' }}>CAPITAL DEPLOYED</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>
              {usd(sumFacilityByDeployment(myPortfolio, true))}
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '6px' }}>Funded facilities in your portfolio</p>
          </Card>
          <Card>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', marginBottom: '10px' }}>AVG PERFORMANCE</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--cr)' }}>100%</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text2)', marginTop: '6px' }}>Zero defaults to date</div>
          </Card>
        </div>

        {/* Recent Activity / Status Shortcut */}
        <div className="g2-responsive" style={{ marginBottom: '24px' }}>
          <Card>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Your Recent Deals</h3>
              <Button variant="secondary" size="md" onClick={() => setView('fp_inbox')}>View Inbox</Button>
            </div>
            
            {myPortfolio.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text2)' }}>
                  <div style={{ marginBottom: '20px', color: 'var(--text3)', display: 'flex', justifyContent: 'center' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <line x1="10" y1="9" x2="8" y2="9"></line>
                    </svg>
                  </div>
                  <p style={{ marginBottom: '20px', fontSize: '15px' }}>You haven&apos;t approved any facilities yet.</p>
                  <Button 
                    variant="primary" 
                    style={{ 
                      padding: '12px 32px', 
                      fontSize: '15px', 
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(139, 0, 0, 0.2)' 
                    }} 
                    onClick={() => setView('fp_inbox')}
                  >
                    Review Pending Requests
                  </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {myPortfolio.slice(0, 3).map(d => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #F1F5F9', borderRadius: '8px' }}>
                          <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{d.tr} · {commodityLabel(d.cmd)}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{d.buyer} · {usd(d.ff)}</div>
                          </div>
                          <Badge variant="info">{stageConfig[d.stage]?.l || d.stage}</Badge>
                      </div>
                  ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>Help & Resources</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Guide: Risk Engine</div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text2)' }}>Understand how TradeAxis evaluates risk.</p>
              </div>
              <div style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Settlement Procedures</div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text2)' }}>How TradeVault handles escrows.</p>
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

  const renderPortfolio = () => {
    return (
      <div className="fade-in">
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>My Portfolio</h2>
            <p style={{ fontSize: '14px', color: 'var(--text2)' }}>Detailed breakdown of all facilities currently funded by your organization.</p>
          </div>
          <Button variant="secondary" size="md">Export Data</Button>
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--bdr)' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>DEAL ID</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>COMMODITY</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>COUNTERPARTY</th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>PRINCIPAL</th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>EXPECTED INT.</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {myPortfolio.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '100px 40px', textAlign: 'center' }}>
                    <div style={{ marginBottom: '20px', color: 'var(--text3)', display: 'flex', justifyContent: 'center' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z" />
                        <polyline points="3.29 7 12 12 20.71 7" />
                        <line x1="12" y1="22" x2="12" y2="12" />
                      </svg>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text2)' }}>No active portfolio assets</div>
                    <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '8px' }}>Assets will appear here once facility requests are approved and funded.</p>
                  </td>
                </tr>
              ) : (
                myPortfolio.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '16px', fontSize: '13px', fontWeight: 700, color: 'var(--cr)' }}>{t.id}</td>
                    <td style={{ padding: '16px', fontSize: '13px' }}>
                      <div style={{ fontWeight: 600 }}>{commodityLabel(t.cmd)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Grade {t.gr}</div>
                    </td>
                    <td style={{ padding: '16px', fontSize: '13px' }}>{t.buyer}</td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{usd(t.ff)}</td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#8B0000' }}>{usd(t.ff * 0.12)}</td>
                    <td style={{ padding: '16px' }}>
                      <Badge variant="info">{stageConfig[t.stage]?.l || t.stage}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleCompleteStep = async () => {
    const stepPayload: {
      step: number;
      reviewer_name?: string;
      approver_name?: string;
      bank_name?: string;
      bank_swift?: string;
    } = { step: onboardingStep };

    if (onboardingStep === 3) {
      if (!reviewerName.trim() || !approverName.trim()) {
        onNotify('Please enter both the reviewer and approver names.', 'error');
        return;
      }
      stepPayload.reviewer_name = reviewerName.trim();
      stepPayload.approver_name = approverName.trim();
    }

    if (onboardingStep === 4) {
      if (!bankName.trim() || !bankSwift.trim()) {
        onNotify('Please enter both the bank name and SWIFT code.', 'error');
        return;
      }
      stepPayload.bank_name = bankName.trim();
      stepPayload.bank_swift = bankSwift.trim();
    }

    try {
      setSavingStep(true);
      const res = await apiClient.updateFpOnboarding(stepPayload);
      setOnboardingDone(!!res.onboarding_done);
      setOnboardingStep(res.onboarding_done ? 6 : res.onboarding_step);
      onNotify(res.onboarding_done ? 'Onboarding complete — you can now review facility requests.' : `Step ${onboardingStep} completed.`);
    } catch {
      onNotify('Failed to save progress. Please try again.', 'error');
    } finally {
      setSavingStep(false);
    }
  };

  const renderOnboarding = () => {
    const steps = [
      { n: 1, l: 'Due Diligence on Miziba', desc: "Review Miziba's operations and track record (0% default rate)." },
      { n: 2, l: 'Master Framework Agreement', desc: 'Execution of governs facility terms and waterfall priority.' },
      { n: 3, l: 'Portal Access Setup', desc: 'Nominating reviewers and approvers with 2FA access.' },
      { n: 4, l: 'Escrow Bank Account Setup', desc: 'Registration of swifts and account details for disbursements.' },
      { n: 5, l: 'First Deal Briefing', desc: 'Orientation with Deal Officer on current bridge deal cycles.' }
    ];

    if (onboardingLoading) {
      return (
        <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text3)' }}>
          Loading onboarding status…
        </div>
      );
    }

    if (onboardingStep > 5) {
      return (
        <div className="fade-in">
          <Card style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--cr)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" opacity="0.2" />
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Onboarding Complete</h2>
            <p style={{ marginTop: '12px', color: '#6B7280', maxWidth: '400px', margin: '12px auto' }}>
              Your partner account is now fully verified. You can now review pending requests and manage your capital deployment.
            </p>
            <Button 
              variant="primary" 
              style={{ marginTop: '24px' }}
              onClick={() => setView('fp_overview')}
            >
              Go to Finance Partner Overview
            </Button>
          </Card>
        </div>
      );
    }

    const currentStep = steps[onboardingStep - 1];

    return (
      <div className="fade-in">
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>Partner Onboarding</h2>
          <p style={{ color: '#6B7280', marginTop: '4px' }}>Complete the setup to activate your capital deployment access.</p>
        </div>

        <div className="card">
          <div className="tabs" style={{ marginBottom: '32px', borderBottom: '1px solid var(--bdr)', display: 'flex', overflowX: 'auto' }}>
            {steps.map((s) => (
              <button 
                key={s.n}
                className={`tab ${onboardingStep === s.n ? 'on' : ''}`} 
                style={{ 
                  padding: '10px 16px', 
                  background: 'none', 
                  border: 'none', 
                  cursor: onboardingStep > s.n ? 'pointer' : 'default',
                  borderBottom: onboardingStep === s.n ? '2px solid var(--cr)' : '2px solid transparent',
                  color: onboardingStep === s.n ? 'var(--cr)' : onboardingStep > s.n ? 'var(--text)' : 'var(--text3)',
                  fontWeight: 600,
                  fontSize: '12px',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => {
                  if (s.n < onboardingStep) {
                    setOnboardingStep(s.n);
                  }
                }}
              >
                {s.n}. {s.l.split(' ')[0]} {s.l.split(' ')[1]}
              </button>
            ))}
          </div>

          <div className="fade-in" style={{ minHeight: '300px' }}>
            <div style={{ 
              padding: '28px 40px', 
              marginBottom: '32px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
              border: '1.5px solid transparent',
              backgroundImage: 'linear-gradient(#FFF9F9, #FFF9F9), linear-gradient(135deg, var(--cr), var(--pu))',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              borderRadius: '16px'
            }}>
              <div style={{ fontWeight: 800, fontSize: '24px', color: 'var(--text)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                {currentStep.l}
              </div>
              <p style={{ fontSize: '16px', color: 'var(--text2)', fontWeight: 500, lineHeight: 1.6 }}>
                {currentStep.desc}
              </p>
            </div>

            {onboardingStep === 1 && (
              <div style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '16px' }}>Review Miziba&apos;s operational history and risk mitigation strategies. Miziba maintains a perfect 0% default rate across all past trades.</p>
                <div className="alert" style={{ background: 'var(--cr-bg)', border: '1px solid var(--cr-b)', color: 'var(--cr)', padding: '16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <strong>Note:</strong> Comprehensive Due Diligence report is available in the Documents section.
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '16px' }}>The Master Framework Agreement (MFA) establishes the legal basis for our partnership and multi-deal facility structure.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ padding: '8px', background: 'var(--cr-bg)', borderRadius: '8px', color: 'var(--cr)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <line x1="10" y1="9" x2="8" y2="9"></line>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>Miziba_MFA_Draft_v2.pdf</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Pending Signature · Document being finalised by Miziba legal team</div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    title="Document not yet available for download"
                  >
                    Pending
                  </Button>
                </div>
                <p style={{ marginTop: '12px', fontSize: '12px', color: '#94A3B8' }}>
                  The document will be available for download and signature once the Miziba legal team finalises it. Proceeding here acknowledges you have been notified of this step.
                </p>
              </div>
            )}

            {onboardingStep === 3 && (
              <div style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '16px' }}>Configure access levels for your team. Every transaction requires dual-approval for security compliance.</p>
                <div className="g2">
                  <div className="field">
                    <label>Designated Reviewer</label>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={reviewerName}
                      onChange={e => setReviewerName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Designated Approver</label>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={approverName}
                      onChange={e => setApproverName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {onboardingStep === 4 && (
              <div style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '16px' }}>Provide the details for the capital disbursement account. This account must be held in USD or equivalent stable currency.</p>
                <div className="g2">
                  <div className="field">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ecobank Ghana"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>SWIFT / Routing</label>
                    <input
                      type="text"
                      placeholder="e.g. ECOBGHAC"
                      value={bankSwift}
                      onChange={e => setBankSwift(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              </div>
            )}

            {onboardingStep === 5 && (
              <div style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '24px' }}>A formal orientation session with your assigned Deal Officer to walkthrough active cycles and the risk reporting dashboard.</p>
                {briefingDate ? (
                  <div style={{ padding: '20px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '12px', color: '#9A3412' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>Scheduled Session</div>
                    <div>{new Date(briefingDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · 10:00 AM GMT</div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#64748B' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>Session to be Scheduled</div>
                    <div>Your Deal Officer will contact you to arrange a convenient time. Completing this step confirms you are ready to proceed.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #F3F4F6' }}>
            <button
              className="btn btn-secondary"
              disabled={onboardingStep === 1}
              onClick={() => setOnboardingStep(s => Math.max(1, s - 1))}
            >
              Previous
            </button>
            <Button
              variant="primary"
              disabled={savingStep}
              onClick={handleCompleteStep}
            >
              {savingStep ? 'Saving…' : onboardingStep === 5 ? 'Finish Onboarding' : 'Complete Step ' + onboardingStep + ' →'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    return (
      <div className="fade-in">
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>Settlement Reports</h2>
          <p style={{ fontSize: '14px', color: 'var(--text2)' }}>Detailed breakdown of payouts, fees, and historical performance.</p>
        </div>
        <Card style={{ textAlign: 'center', color: '#9CA3AF' }}>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center', color: 'var(--cr)' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>Report Engine Initializing</div>
          <p style={{ marginTop: '10px', fontSize: '14px', maxWidth: '400px', margin: '10px auto', color: 'var(--text2)' }}>
            Historical settlement data is being synchronized. Comprehensive PDF reports for the current quarter will be available shortly.
          </p>
        </Card>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="content-area" style={{ width: '100%', maxWidth: '100%' }}>
        {subView === 'inbox' && renderInbox()}
        {subView === 'overview' && renderOverview()}
        {subView === 'portfolio' && renderPortfolio()}
        {subView === 'onboarding' && renderOnboarding()}
        {subView === 'reports' && renderReports()}
      </div>
    </div>
  );
};

export default FinancePartnerPortal;
