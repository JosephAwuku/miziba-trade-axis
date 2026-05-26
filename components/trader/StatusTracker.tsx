"use client";

import React from 'react';
import { Trade } from '@/lib/types';
import { commodityLabel } from '@/lib/data';
import { CheckIcon } from '../ui/CheckIcon';
import TraderKycReminderCard from './TraderKycReminderCard';

interface StatusTrackerProps {
  trade: Trade;
  kycStatus?: string;
  onNavigateToVerify?: () => void;
}

function getStageMessage(stage: string): string {
  switch (stage) {
    case 'SUBMITTED':
      return 'Your application was received. A Deal Officer will begin validation shortly.';
    case 'UNDER_VALIDATION':
      return 'Our team is verifying your documents, buyer, and commercial terms. Upload any missing files in the Documents section below.';
    case 'VALIDATED':
      return 'Internal validation is complete. Risk scoring and Finance Partner review are next.';
    case 'FINANCE_REVIEW':
      return 'Your Finance Data Package is with the Finance Partner for approve/decline decision.';
    case 'FUNDED':
      return 'Facility approved. Capital deployment and procurement will begin.';
    case 'PROCURING':
      return 'Procurement and logistics are in progress. Upload shipment documents when available.';
    case 'DELIVERED':
      return 'Goods delivered. Buyer payment and settlement are being processed.';
    case 'SETTLED':
      return 'Settlement complete. Your residual payout will follow the agreed waterfall.';
    case 'CLOSED':
      return 'This trade is closed. All records are archived.';
    default:
      return 'Your deal team is processing this stage.';
  }
}

const StatusTracker: React.FC<StatusTrackerProps> = ({ trade, kycStatus, onNavigateToVerify }) => {
  const kycBlocked = kycStatus && kycStatus !== 'VERIFIED';
  const STEPS: Trade['stage'][] = ['SUBMITTED', 'VALIDATED', 'FUNDED', 'PROCURING', 'DELIVERED', 'SETTLED'];

  const currentIndex = STEPS.indexOf(trade.stage as Trade['stage']);

  const getDisplayIndex = () => {
    if (currentIndex !== -1) return currentIndex;

    const ALL_STAGES: Trade['stage'][] = [
      'SUBMITTED', 'UNDER_VALIDATION', 'VALIDATED', 'FINANCE_REVIEW', 'FUNDED',
      'PROCURING', 'DELIVERED', 'SETTLED', 'CLOSED',
    ];
    const actualIndex = ALL_STAGES.indexOf(trade.stage);

    if (actualIndex <= 0) return 0;
    if (actualIndex >= ALL_STAGES.indexOf('SETTLED')) return 5;

    if (trade.stage === 'UNDER_VALIDATION') return 0;
    if (trade.stage === 'FINANCE_REVIEW') return 1;

    return 0;
  };

  const ci = getDisplayIndex();

  return (
    <>
      {kycBlocked && onNavigateToVerify && (
        <TraderKycReminderCard onNavigateToCompany={onNavigateToVerify} />
      )}

      <div className="card" style={{ padding: '20px', marginBottom: '14px' }}>
      <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Trade Application Tracker</div>
      <p style={{ fontSize: '13.5px', color: '#6B7280', marginBottom: '22px', fontWeight: 500 }}>
        {trade.id} · {commodityLabel(trade.cmd)} Grade {trade.gr} · {trade.vol} MT · {trade.buyer}
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
                    fontSize: '14px',
                    fontWeight: 800,
                    background: done ? '#8B0000' : cur ? '#8B0000' : '#F3F4F6',
                    color: done || cur ? '#fff' : '#9CA3AF',
                    border: `2px solid ${done ? '#8B0000' : cur ? '#8B0000' : '#E5E7EB'}`,
                    boxShadow: cur ? '0 0 0 3px rgba(139,0,0,0.15)' : 'none',
                  }}
                >
                  {done ? <CheckIcon size={15} strokeWidth={3} color="#fff" /> : i + 1}
                </div>
                <span
                  className="step-label"
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textAlign: 'center',
                    width: '80px',
                    lineHeight: '1.3',
                    color: done ? '#8B0000' : cur ? '#8B0000' : '#9CA3AF',
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
                    background: done ? '#8B0000' : '#E5E7EB',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="alert alert-warning" style={{ marginBottom: 0 }}>
        <p style={{ fontSize: '14px', lineHeight: '1.6', fontWeight: 500, margin: 0 }}>{getStageMessage(trade.stage)}</p>
      </div>
      </div>
    </>
  );
};

export default StatusTracker;


