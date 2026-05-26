# UI Workflow Integration Guide

This guide explains how to update the UI components to properly reflect and enforce the new trade workflow system.

## Components That Need Updates

### 1. `components/views/DealDetail.tsx`

**Current Status:** Basic stage advancement buttons

**Required Updates:**

#### Add Workflow Status Indicators

Show users exactly what needs to be done before advancing:

```tsx
// Add workflow status component
const WorkflowStatus = ({ trade, guards }: { trade: Trade, guards: any }) => {
  const getBlockers = () => {
    if (trade.stage === 'UNDER_VALIDATION' && !guards.validationComplete) {
      return 'Complete all 5 validation items before advancing.';
    }
    if (trade.stage === 'VALIDATED' && !guards.riskScored) {
      return 'Risk scoring required before Finance Review.';
    }
    if (trade.stage === 'VALIDATED' && guards.ceoApproved === false) {
      return 'High-risk trade requires CEO approval.';
    }
    if (trade.stage === 'FINANCE_REVIEW' && !guards.fpApproved) {
      return 'Awaiting Finance Partner decision.';
    }
    if (trade.stage === 'FUNDED' && !guards.capitalDeployed) {
      return 'Deploy at least 60% capital before procurement.';
    }
    if (trade.stage === 'PROCURING' && !guards.goodsDelivered) {
      return 'Confirm goods delivered before advancing.';
    }
    if (trade.stage === 'DELIVERED' && !guards.buyerPaid) {
      return 'Record buyer payment before settlement.';
    }
    if (trade.stage === 'DELIVERED' && !guards.waterfallComplete) {
      return 'Complete waterfall settlement (dual CFO signature).';
    }
    if (trade.stage === 'SETTLED' && !guards.closureComplete) {
      return 'Complete all 7 closure checklist items.';
    }
    return null;
  };

  const blocker = getBlockers();
  
  if (!blocker) return null;

  return (
    <Alert variant="warning">
      <strong>Action Required:</strong> {blocker}
    </Alert>
  );
};
```

#### Update Stage Advancement Logic

Replace direct stage changes with workflow-aware advancement:

```tsx
const handleAdvanceStage = async (nextStage: string) => {
  try {
    setLoading(true);
    
    // The API will check guards automatically
    const response = await apiClient.patch(`/api/trades/${dealId}`, {
      stage: nextStage
    });
    
    if (response.error === 'INVALID_TRANSITION') {
      // Show specific blocker message
      onNotify(response.message, 'error');
      
      // Show what's missing
      if (response.guards) {
        console.log('Missing requirements:', response.guards);
      }
      return;
    }
    
    onNotify('Stage advanced successfully');
    fetchDeal();
  } catch (err: any) {
    const message = err.message || 'Failed to advance stage';
    onNotify(message, 'error');
  } finally {
    setLoading(false);
  }
};
```

#### Add Action Buttons Based on Current Stage

```tsx
const renderStageActions = () => {
  const { stage, risk_score } = trade;
  
  // UNDER_VALIDATION: Show validation checklist progress
  if (stage === 'UNDER_VALIDATION') {
    return (
      <ValidationProgress 
        tradeId={trade.id}
        onComplete={() => {
          onNotify('All validation items complete! Trade advanced to VALIDATED.');
          fetchDeal();
        }}
      />
    );
  }
  
  // VALIDATED: Show risk scoring or CEO approval status
  if (stage === 'VALIDATED') {
    if (!risk_score) {
      return (
        <Button onClick={() => setActiveTab('risk')}>
          📊 Complete Risk Scoring
        </Button>
      );
    }
    
    if (risk_score < 55) {
      return (
        <CEOApprovalStatus tradeId={trade.id} />
      );
    }
    
    return (
      <Button onClick={() => handleGenerateFDP()}>
        📤 Generate FDP & Send to Finance Partner
      </Button>
    );
  }
  
  // FINANCE_REVIEW: Show FP decision status
  if (stage === 'FINANCE_REVIEW') {
    return <FPDecisionStatus tradeId={trade.id} />;
  }
  
  // FUNDED: Show capital deployment
  if (stage === 'FUNDED') {
    return (
      <DeploymentControl 
        tradeId={trade.id}
        currentPct={trade.capital_deployed_pct}
        onUpdate={(pct) => {
          if (pct >= 60) {
            onNotify('Capital deployment complete. Ready for procurement.');
          }
        }}
      />
    );
  }
  
  // PROCURING: Show delivery confirmation
  if (stage === 'PROCURING') {
    return (
      <DeliveryConfirmation 
        tradeId={trade.id}
        expectedWeight={trade.volume_mt}
        onConfirm={() => {
          onNotify('Delivery confirmed. Trade can advance to DELIVERED.');
          fetchDeal();
        }}
      />
    );
  }
  
  // DELIVERED: Show settlement actions
  if (stage === 'DELIVERED') {
    return (
      <SettlementPanel 
        tradeId={trade.id}
        onComplete={() => {
          onNotify('Settlement complete! Trade moved to SETTLED.');
          fetchDeal();
        }}
      />
    );
  }
  
  // SETTLED: Show closure checklist
  if (stage === 'SETTLED') {
    return (
      <ClosureChecklist 
        tradeId={trade.id}
        onComplete={() => {
          onNotify('Trade closed and locked.');
          fetchDeal();
        }}
      />
    );
  }
  
  return null;
};
```

---

### 2. Validation Progress Component

Create `components/trade/ValidationProgress.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface ValidationItem {
  id: string;
  label: string;
  status: boolean;
  notes: string;
}

export const ValidationProgress = ({ 
  tradeId, 
  onComplete 
}: { 
  tradeId: string;
  onComplete: () => void;
}) => {
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchValidation();
  }, [tradeId]);

  const fetchValidation = async () => {
    const data = await apiClient.get(`/api/trades/${tradeId}/validation`);
    setValidation(data);
    
    // Check if all complete
    if (data.overall_progress === 100) {
      onComplete();
    }
  };

  const updateItem = async (itemId: string, completed: boolean, notes: string) => {
    setLoading(true);
    try {
      await apiClient.patch(`/api/trades/${tradeId}/validation`, {
        item_id: itemId,
        completed,
        notes
      });
      fetchValidation();
    } finally {
      setLoading(false);
    }
  };

  if (!validation) return <div>Loading...</div>;

  return (
    <div className="validation-progress">
      <h3>Validation Checklist</h3>
      <div className="progress-bar">
        <div style={{ width: `${validation.overall_progress}%` }} />
      </div>
      <p>{validation.overall_progress}% Complete</p>
      
      {Object.entries(validation.checklist).map(([section, data]: [string, any]) => (
        <div key={section} className="validation-section">
          <h4>{section.toUpperCase()}</h4>
          {data.items.map((item: ValidationItem) => (
            <ValidationItem
              key={item.id}
              item={item}
              onUpdate={(completed, notes) => updateItem(item.id, completed, notes)}
              disabled={loading}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
```

---

### 3. CEO Approval Status Component

Create `components/trade/CEOApprovalStatus.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

export const CEOApprovalStatus = ({ tradeId }: { tradeId: string }) => {
  const { user } = useAuth();
  const [escalation, setEscalation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEscalation();
  }, [tradeId]);

  const fetchEscalation = async () => {
    const data = await apiClient.get(`/api/trades/${tradeId}/ceo-decision`);
    setEscalation(data);
  };

  const handleDecision = async (decision: string, notes: string) => {
    setLoading(true);
    try {
      await apiClient.post(`/api/trades/${tradeId}/ceo-decision`, {
        decision,
        notes
      });
      fetchEscalation();
    } finally {
      setLoading(false);
    }
  };

  if (!escalation) return <div>Loading...</div>;

  if (escalation.escalation?.decision === 'approve_direct') {
    return (
      <Alert variant="success">
        ✅ CEO Approved - Ready for Finance Review
      </Alert>
    );
  }

  if (user?.role === 'ceo') {
    return (
      <div className="ceo-decision-panel">
        <Alert variant="warning">
          ⚠️ High Risk Trade - CEO Approval Required
        </Alert>
        <Button onClick={() => handleDecision('approve_direct', 'Approved')} disabled={loading}>
          ✅ Approve Trade
        </Button>
        <Button onClick={() => handleDecision('decline', 'Risk too high')} disabled={loading} variant="danger">
          ❌ Decline Trade
        </Button>
      </div>
    );
  }

  return (
    <Alert variant="warning">
      ⏳ Awaiting CEO Approval (High Risk Trade)
    </Alert>
  );
};
```

---

### 4. FP Decision Status Component

Create `components/trade/FPDecisionStatus.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

export const FPDecisionStatus = ({ tradeId }: { tradeId: string }) => {
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDecisions();
  }, [tradeId]);

  const fetchDecisions = async () => {
    const data = await apiClient.get(`/api/trades/${tradeId}/fp-decision`);
    setDecisions(data.decisions || []);
  };

  const handleDecision = async (decision: string, notes: string) => {
    setLoading(true);
    try {
      await apiClient.post(`/api/trades/${tradeId}/fp-decision`, {
        decision,
        notes
      });
      fetchDecisions();
    } finally {
      setLoading(false);
    }
  };

  const latestDecision = decisions[0];

  if (latestDecision?.decision === 'approve') {
    return (
      <Alert variant="success">
        ✅ Approved by Finance Partner
      </Alert>
    );
  }

  if (latestDecision?.decision === 'decline') {
    return (
      <Alert variant="danger">
        ❌ Declined by Finance Partner: {latestDecision.notes}
      </Alert>
    );
  }

  if (user?.role === 'finance_partner') {
    return (
      <div className="fp-decision-panel">
        <h3>Finance Partner Decision Required</h3>
        <Button onClick={() => handleDecision('approve', 'Terms acceptable')} disabled={loading}>
          ✅ Approve & Fund
        </Button>
        <Button onClick={() => handleDecision('decline', 'Risk too high')} disabled={loading} variant="danger">
          ❌ Decline
        </Button>
        <Button onClick={() => handleDecision('info_request', 'Need more info')} disabled={loading} variant="secondary">
          📋 Request Information
        </Button>
      </div>
    );
  }

  return (
    <Alert variant="info">
      ⏳ Awaiting Finance Partner Decision
    </Alert>
  );
};
```

---

### 5. Deployment Control Component

Create `components/trade/DeploymentControl.tsx`:

```tsx
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

export const DeploymentControl = ({ 
  tradeId, 
  currentPct,
  onUpdate 
}: { 
  tradeId: string;
  currentPct: number;
  onUpdate: (pct: number) => void;
}) => {
  const [loading, setLoading] = useState(false);

  const updateDeployment = async (pct: number) => {
    setLoading(true);
    try {
      await apiClient.patch(`/api/trades/${tradeId}/deployment`, {
        capital_deployed_pct: pct
      });
      onUpdate(pct);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="deployment-control">
      <h3>Capital Deployment</h3>
      <div className="progress-bar">
        <div style={{ width: `${currentPct}%`, background: currentPct >= 60 ? 'green' : 'orange' }} />
      </div>
      <p>{currentPct}% Deployed {currentPct >= 60 ? '✅' : '(Need 60% minimum)'}</p>
      
      <div className="deployment-buttons">
        {[0, 25, 50, 60, 75, 100].map(pct => (
          <Button 
            key={pct}
            onClick={() => updateDeployment(pct)}
            disabled={loading}
            variant={currentPct === pct ? 'primary' : 'secondary'}
          >
            {pct}%
          </Button>
        ))}
      </div>
      
      {currentPct >= 60 && (
        <Alert variant="success">
          ✅ Capital deployment complete. Trade can advance to PROCURING.
        </Alert>
      )}
    </div>
  );
};
```

---

## Quick Integration Steps

1. **Update DealDetail.tsx:**
   - Add workflow status indicators
   - Replace hardcoded stage buttons with dynamic action buttons
   - Add error handling for blocked transitions

2. **Create New Components:**
   - ValidationProgress.tsx
   - CEOApprovalStatus.tsx
   - FPDecisionStatus.tsx
   - DeploymentControl.tsx
   - DeliveryConfirmation.tsx
   - SettlementPanel.tsx
   - ClosureChecklist.tsx

3. **Update API Client:**
   - Add error handling for 400 responses with guard details
   - Show user-friendly messages for blocked transitions

4. **Add Visual Indicators:**
   - Progress bars for multi-step processes
   - Status badges for approvals
   - Alert boxes for blockers

5. **Test Each Stage:**
   - Verify all transitions are properly gated
   - Ensure error messages are clear and actionable
   - Test role-based permissions

---

## Testing Checklist

- [ ] Trade starts in SUBMITTED stage
- [ ] Can only advance after completing validation items
- [ ] Risk scoring creates escalation for high-risk trades
- [ ] CEO approval required before FDP generation (if high risk)
- [ ] FP decision automatically advances to FUNDED
- [ ] Capital deployment blocks procurement if < 60%
- [ ] Delivery confirmation required before settlement
- [ ] Dual CFO signature required for settlement
- [ ] All 7 closure items must be complete
- [ ] CLOSED trade is read-only

---

## Error Handling Examples

```tsx
// In your API client wrapper
async function makeRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    if (response.status === 400 && data.error === 'INVALID_TRANSITION') {
      // Show detailed blocker message
      showWorkflowBlocker(data.message, data.guards);
      throw new WorkflowBlockerError(data.message);
    }
    
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}
```

This ensures users always understand why a transition is blocked and what they need to do to proceed.
