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
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px',
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 'min(100%, 800px)' }}>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
          }}
        >
          Complete Your Company/Business Verification
        </div>
        <p
          style={{
            margin: '10px 0 0',
            fontSize: '14px',
            color: 'var(--text2)',
            lineHeight: 1.55,
          }}
        >
          Complete your company profile verification process for your trade applications to be reviewed and funded.
        </p>
      </div>
      <div style={{ flexShrink: 0, alignSelf: 'center' }}>
        <Button
          variant="primary"
          size="sm"
          style={{
            background: '#8B0000',
            border: 'none',
            fontWeight: 700,
            boxShadow: '0 2px 4px rgba(139, 0, 0, 0.2)',
          }}
          onClick={onNavigateToCompany}
        >
          Go to company profile →
        </Button>
      </div>
    </div>
  </Card>
);

export default TraderKycReminderCard;
