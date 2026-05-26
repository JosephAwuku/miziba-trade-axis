"use client";

import React from 'react';
import { Card, Button } from '../ui';

interface TraderKycReminderCardProps {
  onNavigateToCompany: () => void;
  marginBottom?: string;
}

const TraderKycReminderCard: React.FC<TraderKycReminderCardProps> = ({
  onNavigateToCompany,
  marginBottom = '14px',
}) => (
  <Card
    className="fade-in"
    style={{
      marginBottom,
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
      border: '2px solid transparent',
      backgroundImage: 'linear-gradient(#FFF9F9, #FFF9F9), linear-gradient(135deg, var(--cr), var(--pu))',
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
    }}
  >
    <div
      className="flex-stack-mobile"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}
    >
      <p style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6, margin: 0, flex: 1 }}>
        <strong style={{ color: 'var(--text)' }}>Company verification required.</strong> Complete and submit KYC, then
        wait for CEO or Operations Admin approval before this trade can progress in Miziba&apos;s workflow.
      </p>
      <Button
        variant="primary"
        size="sm"
        style={{
          background: '#8B0000',
          border: 'none',
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: '0 2px 4px rgba(139, 0, 0, 0.2)',
        }}
        onClick={onNavigateToCompany}
      >
        Go to company profile →
      </Button>
    </div>
  </Card>
);

export default TraderKycReminderCard;
