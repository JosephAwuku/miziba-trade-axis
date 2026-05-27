"use client";

import React from 'react';
import { ST as stageConfig } from '@/lib/data';

interface StageBadgeProps {
  stage: string;
  /** When set, overrides default badge label size (e.g. larger in dense lists). */
  fontSize?: string;
}

const StageBadge: React.FC<StageBadgeProps> = ({ stage, fontSize }) => {
  const st = stageConfig[stage] ?? {
    l: stage.replace(/_/g, ' '),
    c: '#6B7280',
    bg: '#F9FAFB',
    br: '#E5E7EB',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: st.bg,
        color: st.c,
        padding: '4px 10px',
        borderRadius: '99px',
        fontSize: fontSize ?? '11px',
        fontWeight: 800,
        letterSpacing: '0.02em',
        border: `1px solid ${st.br}`,
        flexShrink: 0,
      }}
    >
      {st.l}
    </span>
  );
};

export default StageBadge;
