"use client";

import React from 'react';
import { Trade } from '@/lib/types';
import { CheckIcon } from '../ui/CheckIcon';
import { getWorkflowBlocker, WorkflowContext } from './workflow-messages';

export const DEAL_OFFICER_STEPS = [
  { id: 'overview', label: 'Overview' },
  { id: 'validation', label: 'Checklist' },
  { id: 'risk', label: 'Risk Score' },
  { id: 'documents', label: 'Documents' },
  { id: 'fdp', label: 'Finance Package' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'settlement', label: 'Settlement' },
] as const;

type OfficerStepId = (typeof DEAL_OFFICER_STEPS)[number]['id'];

function getFocusStepIndex(trade: Trade, ctx: WorkflowContext): number {
  const stage = trade.stage;
  const hasRisk = (trade.risk ?? 0) > 0;

  switch (stage) {
    case 'SUBMITTED':
      return 0;
    case 'UNDER_VALIDATION':
      return 1;
    case 'VALIDATED':
      return hasRisk ? 4 : 2;
    case 'FINANCE_REVIEW':
      return 4;
    case 'FUNDED':
    case 'PROCURING':
      return 5;
    case 'DELIVERED':
      return 6;
    case 'SETTLED':
    case 'CLOSED':
      return 6;
    default:
      return 0;
  }
}

function getStepHint(stepId: OfficerStepId, trade: Trade, ctx: WorkflowContext): string {
  switch (stepId) {
    case 'overview':
      return trade.stage === 'SUBMITTED'
        ? 'Review trade details, then open Checklist to start validation.'
        : 'Review commercial terms, trader, and buyer on this deal.';
    case 'validation':
      return 'Complete all validation checklist items — the trade auto-advances when done.';
    case 'risk':
      return 'Run the risk assessment before sending to Finance Partner review.';
    case 'documents':
      return 'Verify per-deal files (contracts, licences, shipment proofs) uploaded by the trader.';
    case 'fdp':
      if (trade.stage === 'FINANCE_REVIEW') {
        return ctx.fpApproved
          ? 'Finance Partner approved — ready to advance when requirements are met.'
          : 'Generate or review the Finance Data Package; await Finance Partner decision.';
      }
      return 'Generate the Finance Data Package to move this deal to Finance Review.';
    case 'deployment':
      if (trade.stage === 'PROCURING' && !ctx.deliveryConfirmed) {
        return 'Confirm delivery (weight and grades) in Deployment before marking Delivered.';
      }
      return 'Record capital deployment (60% minimum) and delivery confirmations.';
    case 'settlement':
      return 'Record buyer payment and complete dual CFO waterfall signatures.';
    default:
      return '';
  }
}

interface DealOfficerFlowProps {
  trade: Trade;
  activeTab: string;
  workflowContext: WorkflowContext;
  lastError?: string | null;
  availableTabIds: string[];
  onStepClick: (tabId: string) => void;
}

const DealOfficerFlow: React.FC<DealOfficerFlowProps> = ({
  trade,
  activeTab,
  workflowContext,
  lastError,
  availableTabIds,
  onStepClick,
}) => {
  const steps = DEAL_OFFICER_STEPS.filter((s) => availableTabIds.includes(s.id));
  const focusIndex = getFocusStepIndex(trade, workflowContext);
  const focusStep = DEAL_OFFICER_STEPS[Math.min(focusIndex, DEAL_OFFICER_STEPS.length - 1)];
  const progressIndex = Math.max(0, steps.findIndex((s) => s.id === focusStep.id));
  const activeIndex = steps.findIndex((s) => s.id === activeTab);
  const ci = activeIndex >= 0 ? activeIndex : progressIndex;

  const blocker = lastError || getWorkflowBlocker(trade.stage, workflowContext);
  const statusMessage =
    blocker ??
    getStepHint(steps[ci]?.id as OfficerStepId ?? focusStep.id, trade, workflowContext);

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '14px' }}>
      <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '22px' }}>Deal Officer Workflow</div>

      <div
        className="step-wrap"
        style={{
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {steps.map((step, i) => {
          const done =
            trade.stage === 'CLOSED' ? i < steps.length : i < progressIndex;
          const cur = i === ci;
          const clickable = availableTabIds.includes(step.id);

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => clickable && onStepClick(step.id)}
                disabled={!clickable}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                  background: 'none',
                  border: 'none',
                  cursor: clickable ? 'pointer' : 'default',
                  padding: 0,
                }}
              >
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
                    width: '72px',
                    lineHeight: '1.3',
                    color: done ? '#8B0000' : cur ? '#8B0000' : '#9CA3AF',
                  }}
                >
                  {step.label}
                </span>
              </button>

              {i < steps.length - 1 && (
                <div
                  className="step-line"
                  style={{
                    height: '2px',
                    flex: 1,
                    minWidth: '12px',
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

      {statusMessage && trade.stage !== 'CLOSED' && (
        <div className="alert alert-warning" style={{ marginBottom: 0 }}>
          <p style={{ fontSize: '14px', lineHeight: '1.6', fontWeight: 500, margin: 0 }}>{statusMessage}</p>
        </div>
      )}
    </div>
  );
};

export default DealOfficerFlow;
