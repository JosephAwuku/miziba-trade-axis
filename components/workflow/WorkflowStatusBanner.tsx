"use client";

import React from 'react';
import { getWorkflowBlocker, WorkflowContext } from './workflow-messages';

interface WorkflowStatusBannerProps {
  stage: string;
  context: WorkflowContext;
  lastError?: string | null;
}

const WorkflowStatusBanner: React.FC<WorkflowStatusBannerProps> = ({
  stage,
  context,
  lastError,
}) => {
  const blocker = lastError || getWorkflowBlocker(stage, context);

  if (!blocker || stage === 'CLOSED') return null;

  return (
    <div
      className="alert alert-warning"
      style={{ marginBottom: '16px', fontSize: '13px', lineHeight: 1.5 }}
    >
      <strong>Action required:</strong> {blocker}
    </div>
  );
};

export default WorkflowStatusBanner;
