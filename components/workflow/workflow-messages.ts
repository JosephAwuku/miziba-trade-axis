import { nextStage } from '@/lib/business-logic';

export interface WorkflowContext {
  riskScore?: number;
  capitalDeployedPct?: number;
  ceoDecision?: string | null;
  fpApproved?: boolean;
  deliveryConfirmed?: boolean;
  buyerPaid?: boolean;
  waterfallComplete?: boolean;
  closureComplete?: boolean;
}

/** User-facing blocker for the current stage before advancing */
export function getWorkflowBlocker(
  stage: string,
  ctx: WorkflowContext
): string | null {
  const risk = ctx.riskScore ?? 0;
  const needsCeo = risk > 0 && risk < 55;
  const ceoOk = !needsCeo || ctx.ceoDecision === 'approve_direct';

  switch (stage) {
    case 'SUBMITTED':
      return 'Start validation: open the Checklist tab and move the trade to Under Validation.';
    case 'UNDER_VALIDATION':
      return 'Complete all validation checklist items (they auto-advance when done).';
    case 'VALIDATED':
      if (!risk || risk === 0) return 'Complete the risk assessment before Finance Partner review.';
      if (needsCeo && !ceoOk) return 'High-risk trade: CEO must approve before Finance Review.';
      return 'Generate the Finance Data Package to send this deal to Finance Review.';
    case 'FINANCE_REVIEW':
      if (!ctx.fpApproved) return 'Awaiting Finance Partner approve/decline decision.';
      return null;
    case 'FUNDED':
      if ((ctx.capitalDeployedPct ?? 0) < 60) {
        return `Deploy at least 60% capital (currently ${ctx.capitalDeployedPct ?? 0}%).`;
      }
      return null;
    case 'PROCURING':
      if (!ctx.deliveryConfirmed) {
        return 'Confirm goods delivered (weight and grades) before marking as Delivered.';
      }
      return null;
    case 'DELIVERED':
      if (!ctx.buyerPaid) return 'Record buyer payment in the Settlement tab.';
      if (!ctx.waterfallComplete) return 'Complete waterfall settlement (dual CFO signatures required).';
      return null;
    case 'SETTLED':
      if (!ctx.closureComplete) return 'Complete all closure checklist items and lock the record.';
      return null;
    default:
      return null;
  }
}

export function getNextStageLabel(stage: string): string | null {
  const ns = nextStage(stage);
  return ns;
}
