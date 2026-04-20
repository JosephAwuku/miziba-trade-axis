"use client";

import React from 'react';
import { Trade } from '@/lib/types';
import { ST } from '@/lib/data';

interface StatusTrackerProps {
  trade: Trade;
}

const StatusTracker: React.FC<StatusTrackerProps> = ({ trade }) => {
  const STEPS: Trade['stage'][] = ['SUBMITTED', 'VALIDATED', 'FUNDED', 'PROCURING', 'DELIVERED', 'SETTLED'];
  
  // Find current index in the display steps
  const currentIndex = STEPS.indexOf(trade.stage as any);
  
  // If the actual stage isn't in our simplified list, find the closest previous step
  const getDisplayIndex = () => {
    if (currentIndex !== -1) return currentIndex;
    
    const ALL_STAGES: Trade['stage'][] = [
      'SUBMITTED', 'UNDER_VALIDATION', 'VALIDATED', 'FINANCE_REVIEW', 'FUNDED', 
      'PROCURING', 'DELIVERED', 'SETTLED', 'CLOSED'
    ];
    const actualIndex = ALL_STAGES.indexOf(trade.stage);
    
    if (actualIndex <= 0) return 0;
    if (actualIndex >= ALL_STAGES.indexOf('SETTLED')) return 5;
    
    // Mapping for intermediate stages
    if (trade.stage === 'UNDER_VALIDATION') return 0; // Still on SUBMITTED for trader
    if (trade.stage === 'FINANCE_REVIEW') return 1; // On VALIDATED for trader
    
    return 0;
  };

  const ci = getDisplayIndex();

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '14px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>Trade Application Tracker</div>
      <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '18px' }}>
        {trade.id} · {trade.cmd} Grade {trade.gr} · {trade.vol} MT · {trade.buyer}
      </p>

      <div className="step-wrap" style={{ marginBottom: '22px', display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
        {STEPS.map((st, i) => {
          const done = i < ci;
          const cur = i === ci;
          const label = st.charAt(0) + st.slice(1).toLowerCase().replace('_', ' ');
          
          return (
            <React.Fragment key={st}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <div 
                  className="step-dot" 
                  style={{ 
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: done ? '#16A34A' : cur ? '#8B0000' : '#F3F4F6',
                    color: (done || cur) ? '#fff' : '#9CA3AF',
                    border: `2px solid ${done ? '#16A34A' : cur ? '#8B0000' : '#E5E7EB'}`,
                    boxShadow: cur ? '0 0 0 3px rgba(139,0,0,0.15)' : 'none'
                  }}
                >
                  {done ? '✓' : (i + 1)}
                </div>
                <span 
                  className="step-label" 
                  style={{ 
                    fontSize: '9px',
                    fontWeight: 600,
                    textAlign: 'center',
                    width: '60px',
                    lineHeight: '1.3',
                    color: done ? '#16A34A' : cur ? '#8B0000' : '#9CA3AF' 
                  }}
                >
                  {label}
                </span>
              </div>
              
              {i < STEPS.length - 1 && (
                <div 
                  className="step-line" 
                  style={{ 
                    height: '2px',
                    flex: 1,
                    minWidth: '16px',
                    marginBottom: '18px',
                    flexShrink: 0,
                    background: done ? '#16A34A' : '#E5E7EB' 
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="alert alert-warning" style={{ marginBottom: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Stage: {trade.stage.replace('_', ' ')}</div>
        <p style={{ fontSize: '11px', lineHeight: '1.5' }}>
          {trade.stage === 'SUBMITTED' || trade.stage === 'UNDER_VALIDATION' 
            ? "Your application is under review. Deal Officer is verifying KYC documents and offtake contract. Expected: 5 business days."
            : trade.stage === 'VALIDATED' || trade.stage === 'FINANCE_REVIEW'
            ? "Validation complete. Finance Partners are currently reviewing the facility request."
            : trade.stage === 'FUNDED'
            ? "Facility approved and funded! Procurement can now commence."
            : "Reviewing operational progress for this stage."}
        </p>
      </div>
    </div>
  );
};

export default StatusTracker;
