"use client";

import React, { useState, useEffect } from 'react';
import { Trade, RiskAssessment, ValidationChecklist } from '@/lib/types';
import { ST as stageConfig, CMD as commodityConfig, commodityLabel } from '@/lib/data';
import { usd, mt } from '@/lib/utils';
import { Badge, Button, Card, ProgressBar, CheckIcon } from '../ui';
import Settlement from './Settlement';
import RiskAssessmentTool from '../RiskAssessmentTool';
import FDPPreview from '../FDPPreview';
import { apiClient } from '@/lib/api';
import { isApiError } from '@/lib/api-errors';
import { nextStage } from '@/lib/business-logic';
import DealOfficerFlow from '../workflow/DealOfficerFlow';
import { WorkflowContext } from '../workflow/workflow-messages';
import FpDecisionPanel from '../workflow/FpDecisionPanel';
import CeoDecisionPanel from '../workflow/CeoDecisionPanel';
import DeliveryConfirmPanel from '../workflow/DeliveryConfirmPanel';
import ClosureChecklistPanel from '../workflow/ClosureChecklistPanel';

interface DealDetailProps {
  dealId: string;
  trades: Trade[];
  onBack: () => void;
  role: string;
  onUpdateTrade: (id: string, updates: Partial<Trade>) => void;
  onNotify: (msg: string, type?: string) => void;
  onRefresh?: () => void;
}

const DealDetail: React.FC<DealDetailProps> = ({ 
  dealId, 
  trades, 
  onBack, 
  role,
  onUpdateTrade,
  onNotify,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [validationChecklist, setValidationChecklist] = useState<ValidationChecklist | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [workflowCtx, setWorkflowCtx] = useState<WorkflowContext>({});

  const d = trades.find(t => t.id === dealId);

  const refreshWorkflowContext = async () => {
    if (!d) return;
    const ctx: WorkflowContext = {
      riskScore: d.risk ?? undefined,
      capitalDeployedPct: d.dep,
    };
    try {
      if (d.stage === 'VALIDATED' || d.stage === 'FINANCE_REVIEW') {
        const ceo = await apiClient.getCeoEscalation(dealId);
        ctx.ceoDecision = ceo.escalation?.decision ?? null;
      }
      if (d.stage === 'FINANCE_REVIEW' || d.stage === 'FUNDED') {
        const fp = await apiClient.getFpDecisions(dealId);
        ctx.fpApproved = fp.decisions?.[0]?.decision === 'approve';
      }
      if (d.stage === 'FUNDED') {
        const dep = await apiClient.getDeploymentStatus(dealId);
        ctx.capitalDeployedPct = dep.capital_deployed_pct;
      }
      if (d.stage === 'PROCURING' || d.stage === 'DELIVERED') {
        const del = await apiClient.getDeliveryStatus(dealId);
        ctx.deliveryConfirmed = del.can_advance_to_delivered;
      }
      if (d.stage === 'DELIVERED' || d.stage === 'SETTLED') {
        const settlement = await apiClient.getSettlementData(dealId);
        ctx.buyerPaid = (settlement.progress?.percentage ?? 0) >= 100;
        ctx.waterfallComplete =
          (settlement as any).signatures?.length >= 2 ||
          settlement.progress?.status === 'finalized';
      }
      if (d.stage === 'SETTLED' || d.stage === 'CLOSED') {
        const closure = await apiClient.getClosureChecklist(dealId);
        ctx.closureComplete = closure.can_close;
      }
    } catch {
      // Non-fatal: banner falls back to stage heuristics
    }
    setWorkflowCtx(ctx);
  };

  useEffect(() => {
    refreshWorkflowContext();
    setLastError(null);
  }, [dealId, d?.stage, d?.risk, d?.dep]);
  
  useEffect(() => {
    if (activeTab === 'risk') {
      fetchRisk();
    } else if (activeTab === 'validation') {
      fetchValidation();
    } else if (activeTab === 'documents') {
      fetchDocuments();
    } else if (activeTab === 'timeline') {
      fetchTimeline();
    }
  }, [activeTab, dealId]);

  const fetchRisk = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getRiskAssessment(dealId);
      setRiskAssessment(res as any);
    } catch (err) {
      onNotify('Failed to fetch risk assessment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchValidation = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getValidationChecklist(dealId);
      setValidationChecklist(res.checklist);
    } catch (err) {
      onNotify('Failed to fetch validation checklist', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getTradeDocuments(dealId);
      setDocuments(res.documents || []);
    } catch (err) {
      onNotify('Failed to fetch trade documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getTradeTimeline(dealId);
      setTimeline(res);
    } catch (err) {
      onNotify('Failed to fetch trade timeline', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  if (!d) return null;

  const handleWorkflowRefresh = () => {
    onRefresh?.();
    refreshWorkflowContext();
    if (activeTab === 'timeline') fetchTimeline();
  };

  const handleAdvanceStage = async (newStage: string) => {
    try {
      setLoading(true);
      setLastError(null);
      const res = await apiClient.advanceTradeStage(dealId, newStage);
      if (res.trade) {
        onNotify(`Trade advanced to ${newStage.replace(/_/g, ' ')}`);
        onUpdateTrade(dealId, { stage: res.trade.stage as Trade['stage'] });
        handleWorkflowRefresh();
      }
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.message : 'Failed to advance stage';
      setLastError(msg);
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const tryAdvanceToNextStage = async () => {
    if (!d) return;
    const ns = nextStage(d.stage);
    if (ns) await handleAdvanceStage(ns);
  };

  if (!d) return null;

  const cm = commodityConfig[d.cmd];
  const tr = d.risk || 0;
  const rc = tr >= 75 ? '#8B0000' : tr >= 55 ? '#D97706' : '#DC2626';
  
  const canEdit = role === 'deal_officer' || role === 'ceo';
  const isObserver = role === 'ops_admin';
  const isCFO = role === 'cfo';
  
  const tabs = [
    { id: 'overview', l: 'Overview' },
    { id: 'validation', l: 'Checklist' },
    { id: 'risk', l: 'Risk Score' },
    { id: 'documents', l: 'Trade documents' },
    { id: 'timeline', l: 'Timeline' },
  ];

  if (canEdit || isCFO || role === 'finance_partner' || isObserver) {
    tabs.push({ id: 'settlement', l: 'Settlement' });
  }

  if (canEdit || role === 'finance_partner' || isObserver) {
    tabs.push({ id: 'deployment', l: 'Deployment' });
    tabs.push({ id: 'fdp', l: 'Finance Package' });
  }

  if ((canEdit || role === 'ceo' || isObserver) && (d.stage === 'SETTLED' || d.stage === 'CLOSED')) {
    tabs.push({ id: 'closure', l: 'Closure' });
  }

  const handleUpdateDeployment = async (pct: number) => {
    try {
      setLoading(true);
      const res = await apiClient.updateDeployment(dealId, pct);
      onNotify(res.message);
      onUpdateTrade(dealId, { dep: pct });
      setWorkflowCtx((prev) => ({ ...prev, capitalDeployedPct: pct }));
    } catch (err) {
      onNotify(isApiError(err) ? err.message : 'Failed to update deployment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateValidation = async (section: string, itemId: string, status?: boolean, notes?: string) => {
    if (!canEdit) return;
    try {
      setLoading(true);
      await apiClient.updateValidationItem(dealId, section, itemId, status ?? false, notes);
      onNotify('Validation updated');
      fetchValidation();
    } catch (err) {
      onNotify('Failed to update validation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderActionCenter = () => {
    if (!canEdit && !isCFO && role !== 'finance_partner' && role !== 'ceo') return null;

    type StepAction =
      | { kind: 'tab'; tab: string; l: string; icon: string }
      | { kind: 'stage'; stage: string; l: string; icon: string }
      | { kind: 'next'; l: string; icon: string };

    let nextStep: StepAction | null = null;
    let description = '';

    if (d.stage === 'SUBMITTED' && canEdit) {
      nextStep = { kind: 'stage', stage: 'UNDER_VALIDATION', l: 'Start validation', icon: 'check' };
      description = 'Move trade to Under Validation and complete the checklist.';
    } else if (d.stage === 'UNDER_VALIDATION' && canEdit) {
      nextStep = { kind: 'tab', tab: 'validation', l: 'Open checklist', icon: 'check' };
      description = 'Complete all validation items (auto-advances when done).';
    } else if (d.stage === 'VALIDATED' && canEdit) {
      if (!d.risk || d.risk === 0) {
        nextStep = { kind: 'tab', tab: 'risk', l: 'Score risk', icon: '📊' };
        description = 'Complete risk assessment before Finance Review.';
      } else {
        nextStep = { kind: 'tab', tab: 'fdp', l: 'Generate FDP', icon: '📄' };
        description = 'Generate Finance Data Package to send to Finance Partner.';
      }
    } else if (d.stage === 'FINANCE_REVIEW') {
      if (role === 'finance_partner') {
        nextStep = { kind: 'tab', tab: 'fdp', l: 'Review & decide', icon: '📋' };
        description = 'Review the FDP and submit approve/decline below.';
      } else if (canEdit) {
        nextStep = { kind: 'tab', tab: 'fdp', l: 'View FDP status', icon: '📄' };
        description = 'Awaiting Finance Partner decision on this facility.';
      }
    } else if (d.stage === 'FUNDED' && canEdit) {
      if ((workflowCtx.capitalDeployedPct ?? d.dep ?? 0) < 60) {
        nextStep = { kind: 'tab', tab: 'deployment', l: 'Record deployment', icon: '💵' };
        description = 'Deploy at least 60% capital before procurement.';
      } else {
        nextStep = { kind: 'next', l: 'Start procurement', icon: '🚜' };
        description = 'Capital threshold met — advance to Procuring.';
      }
    } else if (d.stage === 'PROCURING' && canEdit) {
      if (!workflowCtx.deliveryConfirmed) {
        nextStep = { kind: 'tab', tab: 'deployment', l: 'Confirm delivery', icon: '📦' };
        description = 'Record delivered weight in Deployment tab first.';
      } else {
        nextStep = { kind: 'next', l: 'Mark delivered', icon: '🚢' };
        description = 'Delivery confirmed — advance to Delivered stage.';
      }
    } else if (d.stage === 'DELIVERED' && (isCFO || role === 'ceo' || canEdit)) {
      nextStep = { kind: 'tab', tab: 'settlement', l: 'Settlement', icon: '💰' };
      description = 'Record buyer payment and complete dual CFO waterfall signatures.';
    } else if (d.stage === 'SETTLED' && canEdit) {
      nextStep = { kind: 'tab', tab: 'closure', l: 'Close trade', icon: '🔒' };
      description = 'Complete closure checklist and lock the record.';
    }

    if (!nextStep) return null;

    const runAction = () => {
      if (nextStep!.kind === 'tab') setActiveTab(nextStep!.tab);
      else if (nextStep!.kind === 'stage') handleAdvanceStage(nextStep!.stage);
      else if (nextStep!.kind === 'next') tryAdvanceToNextStage();
    };

    return (
      <Card style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#6B7280', fontSize: '10px', fontWeight: 700, letterSpacing: '.05em', marginBottom: '4px' }}>
              NEXT ACTION
            </div>
            <div style={{ color: '#111827', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
              {nextStep.l}
            </div>
            <div style={{ color: '#6B7280', fontSize: '11px', lineHeight: '1.4' }}>
              {description}
            </div>
          </div>
          <Button 
            variant="primary"
            style={{ fontWeight: 700, flexShrink: 0 }}
            onClick={runAction}
            disabled={loading}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {nextStep.icon === 'check' ? (
                <CheckIcon size={16} strokeWidth={3} color="#fff" />
              ) : (
                <span aria-hidden>{nextStep.icon}</span>
              )}
              {nextStep.l}
            </span>
          </Button>
        </div>
      </Card>
    );
  };

  const renderDeployment = () => {
    return (
      <div className="fade-in">
        <DeliveryConfirmPanel
          tradeId={dealId}
          stage={d.stage}
          expectedVolumeMt={d.vol}
          canEdit={canEdit}
          onNotify={onNotify}
          onSuccess={handleWorkflowRefresh}
        />
        <div className="g2" style={{ marginBottom: '20px' }}>
          <Card title="PROCUREMENT / SHIPMENT METRICS" style={{ padding: '20px' }}>
             <div style={{ marginBottom: '16px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                 <span style={{ fontSize: '12px', fontWeight: 600 }}>Capital Deployed</span>
                 <span className="mono" style={{ fontWeight: 700, color: '#8B0000' }}>{d.dep}%</span>
               </div>
               <ProgressBar value={d.dep} color="#8B0000" height="12px" />
             </div>
             {canEdit && d.stage === 'FUNDED' && (
               <div style={{ display: 'flex', gap: '10px' }}>
                 {[0, 25, 50, 75, 100].map(p => (
                   <Button key={p} variant="secondary" size="sm" onClick={() => handleUpdateDeployment(p)} style={{ flex: 1 }}>
                     {p}%
                   </Button>
                 ))}
               </div>
             )}
          </Card>
          <Card title="LOGISTICS STATUS" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, marginBottom: '4px' }}>SHIPMENT ID</div>
              <div className="mono" style={{ fontSize: '14px', fontWeight: 700 }}>{d.ship || 'Awaiting Creation...'}</div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, marginBottom: '4px' }}>LAST GPS PING</div>
              <div style={{ fontSize: '12px' }}>{d.stage === 'PROCURING' ? '🚢 In Transit (Atlantic Route)' : '—'}</div>
            </div>
          </Card>
        </div>

        <Card title="EUDR COMPLIANCE TRACKING" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              border: '4px solid #8B0000', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800,
              color: '#8B0000'
            }}>98.2%</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>EUDR Compliant Batches</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>All procurement nodes verified against FarmerIQ GPS coordinates.</div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderOverview = () => {
    const fields = [
      ['Trade ID', d.id, true],
      ['Trader', d.tr, false],
      [
        'Company KYC',
        d.traderOrgKyc === 'VERIFIED'
          ? 'Verified (one-time organisation check)'
          : `${d.traderOrgKyc.replace(/_/g, ' ')} — not the same as trade documents below`,
        false,
      ],
      ['Commodity', `${commodityLabel(d.cmd)} Grade ${d.gr}`, false],
      ['Volume', mt(d.vol), true], ['Buyer', `${d.buyer} (${d.bc})`, false],
      ['Price/MT', `$${d.price.toLocaleString()}/MT`, true], ['Contract Value', usd(d.cv), true],
      ['Procurement Cost', usd(d.pc), true], ['Trader Equity', `${usd(d.eq)} (${Math.round(d.eq / d.pc * 100)}%)`, true],
      ['Finance Facility', usd(d.ff), true], ['Delivery Point', d.dp, false],
      ['Deadline', d.dl, true], ['Payment Terms', `${d.pt} days after delivery`, false],
      ['Finance Partner', d.fp || 'Not yet assigned', false], ['Escrow ID', d.escrow || 'Not created', true],
      ['Shipment ID', d.ship || 'Not created', true], ['Deal Officer', d.off, false], ['Applied', d.dt, true]
    ];
    return (
      <Card className="fade-in" style={{ overflow: 'hidden' }}>
        {fields.map((f, i) => (
          <div key={i} style={{ display: 'flex', padding: '8px 14px', borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFBFC', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ width: '170px', flexShrink: 0, fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>{f[0] as string}</span>
            <span className={f[2] ? 'mono' : ''} style={{ fontSize: '14px', flex: 1, minWidth: 0, color: '#111827' }}>{f[1] as string}</span>
          </div>
        ))}
      </Card>
    );
  };

  const renderValidation = () => {
    if (!validationChecklist) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading checklist...</div>;

    const sections = [
      { id: 'kyc', l: 'Trade docs & compliance' },
      { id: 'product', l: 'Product Verification' },
      { id: 'business', l: 'Business Viability' },
      { id: 'shipping', l: 'Logistics & Sourcing' },
    ];

    const pc = Object.values(validationChecklist).filter(s => s.completed).length;
    const ap = pc === 4;

    return (
      <div className="g2 fade-in" style={{ alignItems: 'start' }}>
        <div>
          <Card className="metric" style={{ padding: '16px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Validation Progress</span>
              <span className="mono" style={{ fontWeight: 700, color: ap ? '#8B0000' : '#D97706' }}>{pc}/4</span>
            </div>
            <ProgressBar value={pc * 25} color={ap ? '#8B0000' : '#D97706'} height="8px" />
            {ap && (
              <div style={{ marginTop: '14px' }}>
                <div className="alert alert-success" style={{ marginBottom: '10px' }}>✓ All sections passed. Finance Data Package ready.</div>
                {d.stage === 'UNDER_VALIDATION' && canEdit && (
                  <Button variant="primary" style={{ width: '100%' }} onClick={() => handleAdvanceStage('VALIDATED')} disabled={loading}>
                     ✅ Seal Validation Checklist
                  </Button>
                )}
              </div>
            )}
          </Card>
          
          {sections.map(s => (
            <div key={s.id} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#4B5563', marginBottom: '8px', letterSpacing: '.05em' }}>{s.l.toUpperCase()}</div>
              {(validationChecklist as any)[s.id].items.map((item: any) => (
                <div key={item.id} style={{ marginBottom: '12px', padding: '12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: item.status ? '10px' : '0' }}>
                    <div 
                      className={`chk-box ${item.status ? 'on' : ''}`} 
                      onClick={() => { if (canEdit) handleUpdateValidation(s.id, item.id, !item.status); }}
                      style={{ cursor: canEdit ? 'pointer' : 'default' }}
                    >
                      {item.status && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{item.label}</div>
                    </div>
                  </div>
                  {item.status && (
                    <div className="fade-in" style={{ marginTop: '8px' }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#9CA3AF', marginBottom: '4px', textTransform: 'uppercase' }}>Validation Notes / Justification</label>
                      <textarea 
                        placeholder="Add specific context for this validation..."
                        style={{ width: '100%', height: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '11px' }}
                        defaultValue={item.notes || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (item.notes || '')) {
                            handleUpdateValidation(s.id, item.id, item.status, e.target.value);
                          }
                        }}
                        readOnly={!canEdit}
                        disabled={!canEdit}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div>
          <Card title="ESCALATION RULES" style={{ padding: '14px' }}>
             <p style={{ fontSize: '11px', color: '#4B5563', lineHeight: 1.6 }}>
               Validation must be completed by a Deal Officer.
               <br/><br/>
               If any item fails, the trade will be referred to the Head of Trade for manual override or permanent decline.
             </p>
          </Card>
        </div>
      </div>
    );
  };

  const renderRisk = () => {
    if (loading && !riskAssessment) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading assessment...</div>;

    const handleSaveRisk = async (assessmentData: Partial<RiskAssessment>) => {
      try {
        setLoading(true);
        const res = await apiClient.createRiskAssessment(dealId, {
          risk_score: assessmentData.risk_score || 0,
          breakdown: assessmentData.breakdown
        });
        if (res.success) {
          onNotify('Risk assessment saved successfully');
          onUpdateTrade(dealId, { risk: assessmentData.risk_score });
          fetchRisk();
        }
      } catch (err) {
        onNotify('Failed to save risk assessment', 'error');
      } finally {
        setLoading(false);
      }
    };

    // If internal role and not yet assessed (or explicitly editing), show the tool
    if (canEdit && (!riskAssessment || riskAssessment.risk_score === 0)) {
       return (
         <RiskAssessmentTool 
            initialData={riskAssessment} 
            onSave={handleSaveRisk} 
            loading={loading}
         />
       );
    }

    // Default: Show the results
    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Risk Assessment Result</h3>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setRiskAssessment(null)}>
                ✎ Re-assess Deal
              </Button>
            )}
        </div>
        <div className="g2" style={{ marginBottom: '16px' }}>
          <Card style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, letterSpacing: '.05em', marginBottom: '10px' }}>TOTAL RISK SCORE</div>
              <div style={{ fontSize: '42px', fontWeight: 800, color: rc }}>{riskAssessment?.risk_score || 0}</div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Out of 100 max</div>
            </div>
          </Card>
          <Card style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '12px' }}>ANALYSIS RECOMMENDATIONS</div>
            <ul style={{ paddingLeft: '18px', fontSize: '11px', color: '#4B5563' }}>
              {riskAssessment?.recommendations.map((r, i) => (
                <li key={i} style={{ marginBottom: '6px' }}>{r}</li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="DIMENSIONAL BREAKDOWN">
          <div style={{ padding: '16px' }}>
            {[
              { label: 'Buyer Creditworthiness', key: 'buyer_risk', max: 25 },
              { label: 'Trader Track Record', key: 'trader_risk', max: 25 },
              { label: 'Commodity & Price Volatility', key: 'commodity_price_risk', max: 20 },
              { label: 'Sourcing & Supply Chain', key: 'sourcing_supply_risk', max: 15 },
              { label: 'Logistics & Delivery', key: 'logistics_delivery_risk', max: 15 },
            ].map((f, i) => {
              const score = (riskAssessment?.breakdown as any)?.[f.key] || 0;
              return (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                    <span>{f.label}</span>
                    <span className="mono">{score}/{f.max}</span>
                  </div>
                  <ProgressBar value={(score / f.max) * 100} color={rc} height="4px" />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  };

  const renderDocuments = () => {
    if (loading && !documents.length) return <div className="p20" style={{ textAlign: 'center' }}>Listing trade files...</div>;
    return (
      <Card className="fade-in" title="TRADE DOCUMENTS (THIS DEAL ONLY)">
        <p style={{ padding: '0 16px 12px', margin: 0, fontSize: '12px', color: '#6B7280', lineHeight: 1.55 }}>
          Files for this trade (contracts, licences, shipment proofs). Separate from the trader&apos;s one-time company
          verification in Required Action.
        </p>
        <div className="p16">
          <input
            id="trade-doc-upload-input"
            type="file"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setLoading(true);
                const formData = new FormData();
                formData.append('file', file);
                await apiClient.uploadDocument(dealId, formData);
                onNotify('Supporting document uploaded successfully');
                await fetchDocuments();
              } catch (err) {
                onNotify('Failed to upload supporting document', 'error');
              } finally {
                setLoading(false);
                e.currentTarget.value = '';
              }
            }}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          />
          {!documents.length && <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '12px' }}>No documents uploaded yet.</div>}
          {documents.map((doc, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: idx === documents.length -1 ? 0 : '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>{doc.type.includes('pdf') ? '📄' : '📁'}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{doc.name}</div>
                  <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{new Date(doc.created_at).toLocaleDateString()} · {(doc.size_bytes / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Badge variant={doc.status === 'verified' ? 'success' : 'warning'}>{doc.status.toUpperCase()}</Badge>
                <Button variant="ghost" size="sm" onClick={() => window.open(doc.url, '_blank')}>View</Button>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            style={{ marginTop: '16px', width: '100%' }}
            onClick={() => document.getElementById('trade-doc-upload-input')?.click()}
            disabled={loading}
          >
            + Upload Supporting Document
          </Button>
        </div>
      </Card>
    );
  };

  const renderTimeline = () => {
    if (loading && !timeline.length) return <div className="p20" style={{ textAlign: 'center' }}>Fetching event history...</div>;
    return (
      <Card className="fade-in" title="AUDIT TRAIL & MILESTONES">
        <div className="p16" style={{ position: 'relative' }}>
          <div style={{ 
            position: 'absolute', 
            left: '22px', 
            top: '40px', 
            bottom: '40px', 
            width: '2px', 
            background: '#E5E7EB', 
            zIndex: 0 
          }}></div>
          {timeline.map((event, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '20px', marginBottom: '24px', position: 'relative', zIndex: 1 }}>
              <div style={{ 
                width: '14px', 
                height: '14px', 
                borderRadius: '50%', 
                background: 'white', 
                border: '3px solid #7C3AED', 
                marginTop: '4px',
                flexShrink: 0
              }}></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>{event.action.replace(/_/g, ' ').toUpperCase()}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }} className="mono">{new Date(event.timestamp).toLocaleString()}</div>
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                  Performed by <span style={{ fontWeight: 600, color: '#4B5563' }}>{event.user}</span> ({event.role})
                </div>
              </div>
            </div>
          ))}
          {!timeline.length && <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '12px' }}>No audit logs found for this trade.</div>}
        </div>
      </Card>
    );
  };

  return (
    <div className="fade-in">
      {isObserver && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          fontSize: '12px',
          color: '#475569',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>Read-only access.</span>{' '}
          Operations Admin can view all trade activity but cannot change status or take workflow actions.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#6B7280', fontWeight: 500 }}>
              {d.id} · {commodityLabel(d.cmd)} Grade {d.gr} · {d.vol} MT · {d.buyer}
            </p>
            <Badge variant="info">{stageConfig[d.stage]?.l || d.stage}</Badge>
            <Badge variant={d.traderOrgKyc === 'VERIFIED' ? 'success' : 'warning'}>
              Company KYC: {d.traderOrgKyc === 'VERIFIED' ? 'Verified' : d.traderOrgKyc.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      </div>

      {(canEdit || isCFO || role === 'finance_partner') && (
        <DealOfficerFlow
          trade={d}
          activeTab={activeTab}
          workflowContext={workflowCtx}
          lastError={lastError}
          availableTabIds={tabs.map((t) => t.id)}
          onStepClick={setActiveTab}
        />
      )}

      <CeoDecisionPanel
        tradeId={dealId}
        stage={d.stage}
        riskScore={d.risk || 0}
        role={role}
        onNotify={onNotify}
        onSuccess={handleWorkflowRefresh}
      />

      {renderActionCenter()}

      <div className="g4" style={{ marginBottom: '16px' }}>
        <Card className="metric">
          <div className="metric-label">CONTRACT VALUE</div>
          <div className="metric-val" style={{ fontSize: '16px' }}>{usd(d.cv)}</div>
        </Card>
        <Card className="metric">
          <div className="metric-label">FINANCE FACILITY</div>
          <div className="metric-val" style={{ fontSize: '16px', color: '#7C3AED' }}>{usd(d.ff)}</div>
        </Card>
        <Card className="metric">
          <div className="metric-label">TRADER EQUITY</div>
          <div className="metric-val" style={{ fontSize: '16px', color: '#8B0000' }}>{usd(d.eq)}</div>
        </Card>
        <Card className="metric">
          <div className="metric-label">RISK SCORE</div>
          <div className="metric-val" style={{ color: rc }}>{d.risk ? `${d.risk}/100` : '—'}</div>
        </Card>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button 
            key={t.id} 
            className={`tab ${activeTab === t.id ? 'on' : ''}`} 
            onClick={() => setActiveTab(t.id)}
            disabled={loading}
          >
            {t.l}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'validation' && renderValidation()}
      {activeTab === 'risk' && renderRisk()}
      {activeTab === 'documents' && renderDocuments()}
      {activeTab === 'timeline' && renderTimeline()}
      {activeTab === 'deployment' && renderDeployment()}
      {activeTab === 'settlement' && (
        <Settlement 
          tradeId={dealId} 
          onNotify={onNotify} 
          role={role}
          onSettlementChange={handleWorkflowRefresh}
        />
      )}
      {activeTab === 'fdp' && (
        <>
          {role === 'finance_partner' && (
            <FpDecisionPanel
              tradeId={dealId}
              stage={d.stage}
              onNotify={onNotify}
              onSuccess={() => {
                handleWorkflowRefresh();
                onUpdateTrade(dealId, { stage: 'FUNDED' });
              }}
            />
          )}
          <FDPPreview 
            tradeId={dealId} 
            onNotify={onNotify}
            onGenerated={handleWorkflowRefresh}
            readOnly={isObserver}
          />
        </>
      )}
      {activeTab === 'closure' && (
        <ClosureChecklistPanel
          tradeId={dealId}
          stage={d.stage}
          canEdit={canEdit || role === 'ceo'}
          onNotify={onNotify}
          onSuccess={() => {
            handleWorkflowRefresh();
            onUpdateTrade(dealId, { stage: 'CLOSED' });
          }}
        />
      )}
    </div>
  );
};

export default DealDetail;
