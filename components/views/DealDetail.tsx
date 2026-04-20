"use client";

import React, { useState, useEffect } from 'react';
import { Trade, RiskAssessment, ValidationChecklist } from '@/lib/types';
import { ST as stageConfig, CMD as commodityConfig } from '@/lib/data';
import { usd, mt } from '@/lib/utils';
import { Badge, Button, Card, ProgressBar, CustomSelect } from '../ui';
import Settlement from './Settlement';
import RiskAssessmentTool from '../RiskAssessmentTool';
import FDPPreview from '../FDPPreview';
import { apiClient } from '@/lib/api';

interface DealDetailProps {
  dealId: string;
  trades: Trade[];
  onBack: () => void;
  role: string;
  onUpdateTrade: (id: string, updates: Partial<Trade>) => void;
  onNotify: (msg: string, type?: string) => void;
}

const DealDetail: React.FC<DealDetailProps> = ({ 
  dealId, 
  trades, 
  onBack, 
  role,
  onUpdateTrade,
  onNotify
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [validationChecklist, setValidationChecklist] = useState<ValidationChecklist | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);

  const d = trades.find(t => t.id === dealId);
  
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

  const handleAdvanceStage = async (newStage: string) => {
    try {
      setLoading(true);
      const res = await apiClient.updateTrade(dealId, { stage: newStage });
      if (res.trade) {
        onNotify(`Trade advanced to ${newStage}`);
        onUpdateTrade(dealId, { stage: res.trade.stage as Trade['stage'] });
        // Refresh timeline if on that tab
        if (activeTab === 'timeline') fetchTimeline();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to advance stage';
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!d) return null;

  const cm = commodityConfig[d.cmd];
  const tr = d.risk || 0;
  const rc = tr >= 75 ? '#16A34A' : tr >= 55 ? '#D97706' : '#DC2626';
  
  const canEdit = role === 'deal_officer' || role === 'ceo' || role === 'ops_admin';
  const isCFO = role === 'cfo';
  
  const tabs = [
    { id: 'overview', l: 'Overview' },
    { id: 'validation', l: 'Checklist' },
    { id: 'risk', l: 'Risk Score' },
    { id: 'documents', l: 'Documents' },
    { id: 'timeline', l: 'Timeline' },
  ];

  if (canEdit || isCFO || role === 'finance_partner') {
    tabs.push({ id: 'settlement', l: 'Settlement' });
  }

  if (canEdit || role === 'finance_partner') {
    tabs.push({ id: 'deployment', l: 'Deployment' });
    tabs.push({ id: 'fdp', l: 'Finance Package' });
  }

  const handleUpdateDeployment = async (pct: number) => {
    try {
      setLoading(true);
      await apiClient.updateTrade(dealId, { capital_deployed_pct: pct });
      onNotify('Deployment progress updated');
      onUpdateTrade(dealId, { dep: pct });
    } catch (err) {
      onNotify('Failed to update deployment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleValidation = async (section: string, itemId: string, currentStatus: boolean) => {
    if (!canEdit) return;
    try {
      setLoading(true);
      await apiClient.updateValidationItem(dealId, section, itemId, !currentStatus);
      onNotify('Validation item updated');
      fetchValidation();
    } catch (err) {
      onNotify('Failed to update validation item', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderActionCenter = () => {
    if (!canEdit && !isCFO) return null;

    // Logic for what the "Next Step" is based on stage
    let nextStep = null;
    if (d.stage === 'VALIDATED') {
      nextStep = { l: 'Send to Finance Partner', s: 'FINANCE_REVIEW', icon: '📤' };
    } else if (d.stage === 'FUNDED' && canEdit) {
      nextStep = { l: 'Confirm Equity & Start Procurement', s: 'PROCURING', icon: '🚜' };
    } else if (d.stage === 'PROCURING' && canEdit) {
      nextStep = { l: 'Confirm Goods Delivered', s: 'DELIVERED', icon: '🚢' };
    } else if (d.stage === 'DELIVERED' && (isCFO || role === 'ceo')) {
      nextStep = { l: 'Go to Settlement Tab', s: 'TAB_SETTLEMENT', icon: '💰' };
    }

    if (!nextStep) return null;

    return (
      <Card style={{ 
        background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)', 
        padding: '16px', 
        marginBottom: '20px', 
        border: 'none',
        boxShadow: '0 4px 20px rgba(124, 58, 237, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px', fontWeight: 700, letterSpacing: '.05em', marginBottom: '4px' }}>
              STANDALONE ACTION CENTER
            </div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
              Manual Step Required: {nextStep.l}
            </div>
          </div>
          <Button 
            variant="secondary" 
            style={{ background: '#fff', color: '#4338CA', border: 'none', fontWeight: 700 }}
            onClick={() => {
              if (nextStep?.s === 'TAB_SETTLEMENT') setActiveTab('settlement');
              else if (nextStep?.s) handleAdvanceStage(nextStep.s);
            }}
            disabled={loading}
          >
            {nextStep.icon} {nextStep.l}
          </Button>
        </div>
      </Card>
    );
  };

  const renderDeployment = () => {
    return (
      <div className="fade-in">
        <div className="g2" style={{ marginBottom: '20px' }}>
          <Card title="PROCUREMENT / SHIPMENT METRICS" style={{ padding: '20px' }}>
             <div style={{ marginBottom: '16px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                 <span style={{ fontSize: '12px', fontWeight: 600 }}>Capital Deployed</span>
                 <span className="mono" style={{ fontWeight: 700, color: '#2563EB' }}>{d.dep}%</span>
               </div>
               <ProgressBar value={d.dep} color="#2563EB" height="12px" />
             </div>
             {canEdit && (
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
              border: '4px solid #16A34A', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800,
              color: '#16A34A'
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
      ['Trade ID', d.id, true], ['Trader', d.tr, false], ['Commodity', `${d.cmd} Grade ${d.gr}`, false],
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
            <span style={{ width: '160px', flexShrink: 0, fontSize: '10px', color: '#6B7280', fontWeight: 600 }}>{f[0] as string}</span>
            <span className={f[2] ? 'mono' : ''} style={{ fontSize: '12px', flex: 1, minWidth: 0 }}>{f[1] as string}</span>
          </div>
        ))}
      </Card>
    );
  };

  const renderValidation = () => {
    if (!validationChecklist) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading checklist...</div>;

    const sections = [
      { id: 'kyc', l: 'KYC & Compliance' },
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
              <span className="mono" style={{ fontWeight: 700, color: ap ? '#16A34A' : '#D97706' }}>{pc}/4</span>
            </div>
            <ProgressBar value={pc * 25} color={ap ? '#16A34A' : '#D97706'} height="8px" />
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
                <div key={item.id} className="chk-item">
                  <div 
                    className={`chk-box ${item.status ? 'on' : ''}`} 
                    onClick={() => handleToggleValidation(s.id, item.id, item.status)}
                    style={{ cursor: canEdit ? 'pointer' : 'default' }}
                  >
                    {item.status && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500 }}>{item.label}</div>
                  </div>
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
      <Card className="fade-in" title="TRADE DOCUMENTATION REPOSITORY">
        <div className="p16">
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
          <Button variant="secondary" style={{ marginTop: '16px', width: '100%' }}>+ Upload Supporting Document</Button>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" onClick={onBack}>← Back</Button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '16px', fontWeight: 700, color: '#8B0000' }}>{d.id}</span>
            <Badge variant="info">{stageConfig[d.stage]?.l || d.stage}</Badge>
            <Badge variant={d.kyc === 'VERIFIED' ? 'success' : 'warning'}>{d.kyc}</Badge>
          </div>
          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px' }}>
            {d.tr} · {d.buyer} ({d.bc}) · <Badge variant="default" style={{ background: `${cm?.c || '#000'}15`, color: cm?.c || '#000' }}>{cm?.i} {d.cmd} Grade {d.gr}</Badge>
          </div>
        </div>
        {role === 'ops_admin' && (
          <div style={{ width: '160px' }}>
            <CustomSelect 
              compact
              value={d.stage}
              onChange={(e) => handleAdvanceStage(e.target.value)}
              options={Object.entries(stageConfig).map(([k, cfg]) => ({ label: cfg.l, value: k }))}
            />
          </div>
        )}
      </div>

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
          <div className="metric-val" style={{ fontSize: '16px', color: '#2563EB' }}>{usd(d.eq)}</div>
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
        />
      )}
      {activeTab === 'fdp' && (
        <FDPPreview 
          tradeId={dealId} 
          onNotify={onNotify}
        />
      )}
    </div>
  );
};

export default DealDetail;
