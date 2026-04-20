"use client";

import React, { useState, useEffect } from 'react';
import { Card, ProgressBar, Badge } from '../ui';
import { usd, mt } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { ST as stageConfig, CMD as commodityConfig } from '@/lib/data';

const Portfolio: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPortfolioMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch portfolio metrics', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <div className="animate-pulse" style={{ color: '#6B7280', fontSize: '14px' }}>Loading Portfolio Intelligence...</div>
      </div>
    );
  }

  const stageKeys = Object.keys(metrics.stage_distribution);
  const totalStageCount = metrics.total_deals;

  return (
    <div className="fade-in">
      <div className="g4" style={{ marginBottom: '20px' }}>
        <Card className="metric">
          <div className="metric-label">TOTAL PORTFOLIO VALUE</div>
          <div className="metric-val">{usd(metrics.total_contract_value_usd)}</div>
          <div style={{ fontSize: '10px', color: '#16A34A', marginTop: '4px' }}>Across {metrics.countries_active} active countries</div>
        </Card>
        <Card className="metric">
          <div className="metric-label">CAPITAL DEPLOYED</div>
          <div className="metric-val" style={{ color: '#7C3AED' }}>{usd(metrics.total_facility_usd)}</div>
          <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>{Math.round(metrics.total_facility_usd / metrics.total_contract_value_usd * 100)}% Participation rate</div>
        </Card>
        <Card className="metric">
          <div className="metric-label">AVG RISK SCORE</div>
          <div className="metric-val" style={{ color: metrics.avg_risk_score >= 70 ? '#16A34A' : '#D97706' }}>
            {Math.round(metrics.avg_risk_score)}<small style={{ fontSize: '12px', opacity: 0.6 }}>/100</small>
          </div>
          <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>Weighted portfolio average</div>
        </Card>
        <Card className="metric">
          <div className="metric-label">TOTAL VOLUME</div>
          <div className="metric-val">{mt(metrics.total_volume_mt)}</div>
          <div style={{ fontSize: '10px', color: '#2563EB', marginTop: '4px' }}>{metrics.farmers_reached} farmers impacted</div>
        </Card>
      </div>

      <div className="g2" style={{ alignItems: 'start', gap: '20px' }}>
        <Card title="PIPELINE DISTRIBUTION">
          <div style={{ padding: '20px' }}>
            {stageKeys.map(k => (
              <div key={k} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{stageConfig[k]?.l || k}</span>
                  <span className="mono">{metrics.stage_distribution[k]} deals ({Math.round(metrics.stage_distribution[k] / totalStageCount * 100)}%)</span>
                </div>
                <ProgressBar 
                  value={(metrics.stage_distribution[k] / totalStageCount) * 100} 
                  color={stageConfig[k]?.c || '#6B7280'} 
                  height="6px" 
                />
              </div>
            ))}
          </div>
        </Card>

        <Card title="COMMODITY EXPOSURE">
          <div style={{ padding: '20px' }}>
            {Object.keys(metrics.commodity_breakdown).map(k => (
              <div key={k} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: commodityConfig[k]?.c || '#000' }}></div>
                    <span style={{ fontWeight: 600 }}>{commodityConfig[k]?.l || k}</span>
                  </div>
                  <span className="mono">{usd(metrics.commodity_breakdown[k])}</span>
                </div>
                <ProgressBar 
                  value={(metrics.commodity_breakdown[k] / metrics.total_contract_value_usd) * 100} 
                  color={commodityConfig[k]?.c || '#2563EB'} 
                  height="6px" 
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: '20px' }}>
        <Card title="OPERATIONAL EFFICIENCY">
          <div className="g3" style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, marginBottom: '8px' }}>AVG CYCLE TIME</div>
              <div style={{ fontSize: '24px', fontWeight: 800 }}>{metrics.avg_trade_cycle_days} <small style={{ fontSize: '12px' }}>DAYS</small></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, marginBottom: '8px' }}>SLA COMPLIANCE</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16A34A' }}>{metrics.farmer_sla_compliance_pct}%</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, marginBottom: '8px' }}>WEIGHT RECONCILED</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563EB' }}>{metrics.weight_reconciliation_pct}%</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Portfolio;
