"use client";

import React, { useState, useEffect } from 'react';
import { RiskBreakdown, RiskAssessment } from '@/lib/types';
import { RISK_DIMENSIONS, getRiskRecommendation } from '@/lib/risk-config';
import { Card, Button, ProgressBar } from './ui';

interface RiskAssessmentToolProps {
  initialData?: RiskAssessment | null;
  onSave: (assessment: Partial<RiskAssessment>) => void;
  loading?: boolean;
}

const RiskAssessmentTool: React.FC<RiskAssessmentToolProps> = ({ initialData, onSave, loading }) => {
  const [scores, setScores] = useState<RiskBreakdown>(
    initialData?.breakdown || {
      buyer_risk: 0,
      trader_risk: 0,
      commodity_price_risk: 0,
      sourcing_supply_risk: 0,
      logistics_delivery_risk: 0,
    }
  );

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const rec = getRiskRecommendation(totalScore);

  const handleSetScore = (key: keyof RiskBreakdown, score: number) => {
    setScores(prev => ({ ...prev, [key]: score }));
  };

  const handleSave = () => {
    onSave({
      risk_score: totalScore,
      breakdown: scores,
      recommendations: [rec.label, rec.desc],
      calculated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Risk Scoring Calculator</h2>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>5 dimensions · 100 points · Click tier to select</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: '48px', fontWeight: 800, color: rec.color, lineHeight: 1 }}>{totalScore}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>/100</div>
        </div>
      </div>

      <Card className="metric" style={{ padding: '16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: rec.color }}>{rec.label}</span>
          <span className="mono" style={{ fontWeight: 700, color: rec.color }}>{totalScore}/100</span>
        </div>
        <ProgressBar value={totalScore} color={rec.color} height="12px" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#9CA3AF' }}>
          <span>0</span>
          <span style={{ color: '#991B1B' }}>40 Decline</span>
          <span style={{ color: '#D97706' }}>55 Moderate</span>
          <span style={{ color: '#16A34A' }}>75 Low</span>
          <span>100</span>
        </div>
        <div style={{ 
          marginTop: '16px', 
          padding: '14px 16px', 
          background: rec.bg, 
          border: `1.5px solid ${rec.border}`, 
          borderRadius: '10px', 
          fontSize: '15px', 
          color: rec.color, 
          fontWeight: 600,
          lineHeight: 1.5
        }}>
          {rec.desc}
        </div>
      </Card>

      <div className="g2" style={{ marginBottom: '16px' }}>
        {RISK_DIMENSIONS.map((dim) => {
          const s = scores[dim.key];
          const pct = Math.round((s / dim.max) * 100);
          const dc = pct >= 70 ? '#16A34A' : pct >= 45 ? '#D97706' : '#DC2626';

          return (
            <Card key={dim.key} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{dim.label}</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>{dim.weight} · Max {dim.max}pts</div>
                </div>
                <span className="mono" style={{ fontSize: '26px', fontWeight: 800, color: dc }}>{s}</span>
              </div>
              <ProgressBar value={pct} color={dc} height="6px" />
              <div style={{ marginTop: '12px' }}>
                {dim.tiers.map((tier) => (
                    <div 
                      key={tier.label}
                      className={`risk-tier ${s === tier.score ? 'sel' : ''}`} 
                      onClick={() => handleSetScore(dim.key, tier.score)}
                      style={{
                        display: 'flex',
                        gap: '9px',
                        padding: '8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        marginBottom: '4px',
                        border: '1px solid transparent',
                        backgroundColor: s === tier.score ? 'var(--cr-bg)' : 'transparent',
                        borderColor: s === tier.score ? 'var(--cr-b)' : 'transparent',
                        transition: 'all 0.1s'
                      }}
                    >
                      <span 
                        className="mono" 
                        style={{ 
                          fontSize: '14px', 
                          fontWeight: 700, 
                          color: s === tier.score ? 'var(--cr)' : '#9CA3AF', 
                          width: '24px', 
                          textAlign: 'right', 
                          flexShrink: 0 
                        }}
                      >
                        {tier.score}
                      </span>
                      <span style={{ fontSize: '14px', color: s === tier.score ? 'var(--text)' : '#6B7280', fontWeight: 500, lineHeight: '1.5' }}>
                        {tier.label}
                      </span>
                    </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <Button variant="secondary" onClick={() => setScores(initialData?.breakdown || { buyer_risk: 0, trader_risk: 0, commodity_price_risk: 0, sourcing_supply_risk: 0, logistics_delivery_risk: 0 })}>Reset</Button>
        <Button variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Assessment'}</Button>
      </div>
    </div>
  );
};

export default RiskAssessmentTool;
