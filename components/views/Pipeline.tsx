"use client";

import React from 'react';
import { Trade } from '@/lib/types';
import { ST as stageConfig, CMD as commodityConfig } from '@/lib/data';
import { usd, mt } from '@/lib/utils';
import { Badge, ProgressBar } from '../ui';

interface PipelineProps {
  trades: Trade[];
  onDealSelect: (id: string) => void;
}

const Pipeline: React.FC<PipelineProps> = ({ trades, onDealSelect }) => {
  return (
    <div className="kanban fade-in" style={{ 
      marginTop: '0', 
      paddingBottom: '20px',
      cursor: 'grab' 
    }}>
      {Object.keys(stageConfig).map((stage) => {
        const stageTrades = trades.filter((t) => t.stage === stage);
        const cfg = stageConfig[stage] || { bg: '#F3F4F6', br: '#E5E7EB', c: '#374151', l: stage };
        const totalValue = stageTrades.reduce((a, t) => a + t.cv, 0);

        return (
          <div key={stage} className="k-col" style={{ width: '220px', flex: '0 0 220px' }}>
            <div className="k-head" style={{ 
              background: cfg.bg, 
              border: `1px solid ${cfg.br}`,
              padding: '10px 12px',
              borderBottom: 'none'
            }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: cfg.c, letterSpacing: '0.05em' }}>
                {cfg.l.toUpperCase()}
              </span>
              <span className="badge" style={{ 
                background: '#fff', 
                color: cfg.c, 
                fontSize: '10px', 
                padding: '2px 6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                {stageTrades.length}
              </span>
            </div>
            <div className="k-body" style={{ 
              background: `${cfg.bg}44`, 
              border: `1px solid ${cfg.br}`,
              minHeight: '400px',
              padding: '8px'
            }}>
              {totalValue > 0 && (
                <div style={{ 
                  fontSize: '10px', 
                  color: cfg.c, 
                  textAlign: 'center', 
                  padding: '4px 0 8px', 
                  fontWeight: 700,
                  opacity: 0.8 
                }}>
                  {usd(totalValue)}
                </div>
              )}
              {stageTrades.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#9CA3AF', fontSize: '11px', fontStyle: 'italic' }}>
                  No deals in queue
                </div>
              ) : (
                stageTrades.map((d) => {
                  const cm = commodityConfig[d.cmd];
                  return (
                    <div key={d.id} className="k-card" onClick={() => onDealSelect(d.id)} style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      background: '#fff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span className="mono" style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>{d.id}</span>
                        <span className="badge" style={{ background: `${cm.c}15`, color: cm.c, border: 'none', fontSize: '10px', padding: '2px 6px' }}>
                          {cm.i} {d.cmd}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '2px', color: '#111827' }}>{d.tr}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>{mt(d.vol)} · Gr.{d.gr}</div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="mono" style={{ fontSize: '12px', fontWeight: 800 }}>{usd(d.cv)}</span>
                        {d.risk ? (
                          <Badge variant={d.risk >= 75 ? 'success' : (d.risk >= 55 ? 'warning' : 'danger')} className="mono" style={{ fontSize: '9px' }}>
                            {d.risk}
                          </Badge>
                        ) : (
                          <Badge variant="default" style={{ fontSize: '9px', opacity: 0.5 }}>—</Badge>
                        )}
                      </div>

                      {d.dep > 0 && (
                        <div style={{ marginTop: '10px', borderTop: '1px solid #F3F4F6', paddingTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontSize: '9px', color: '#9CA3AF', fontWeight: 600 }}>DEPLOYED</span>
                            <span className="mono" style={{ fontSize: '10px', color: '#2563EB', fontWeight: 700 }}>{d.dep}%</span>
                          </div>
                          <ProgressBar value={d.dep} color={d.dep > 80 ? 'var(--wa)' : 'var(--su)'} height="4px" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Pipeline;
