"use client";

import React from 'react';
import { Card, Button } from '../ui';
import { getTraderKycGateCopy } from '@/lib/trader-kyc';

interface TraderKycGateProps {
  kycStatus: string;
  onNavigate: (subView: string) => void;
  children?: React.ReactNode;
}

/** Blocks children until organisation KYC is VERIFIED; shows guidance otherwise. */
const TraderKycGate: React.FC<TraderKycGateProps> = ({ kycStatus, onNavigate, children }) => {
  if (kycStatus === 'VERIFIED') {
    return <>{children}</>;
  }

  const copy = getTraderKycGateCopy(kycStatus);
  const alertClass =
    copy.variant === 'info' ? 'alert alert-info' : copy.variant === 'success' ? 'alert alert-success' : 'alert alert-warning';

  return (
    <Card style={{ padding: '40px 32px', textAlign: 'center', maxWidth: '560px', margin: '0 auto' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px', color: 'var(--text)' }}>{copy.title}</h2>
      <p style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '24px' }}>{copy.message}</p>
      <div className={alertClass} style={{ textAlign: 'left', marginBottom: '24px', fontSize: '13px' }}>
        Trade applications are only available after Miziba approves your company verification.
      </div>
      <Button
        variant="primary"
        style={{ background: '#8B0000', border: 'none', padding: '12px 28px' }}
        onClick={() => onNavigate(copy.ctaView)}
      >
        {copy.ctaLabel} →
      </Button>
    </Card>
  );
};

export default TraderKycGate;
