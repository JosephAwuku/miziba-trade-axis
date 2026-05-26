"use client";

import React from 'react';
import { Button } from '../ui';
import { getTraderKycGateCopy, isTraderKycVerified, REQUIRED_KYC_DOC_TYPES } from '@/lib/trader-kyc';

interface TraderKycBannerProps {
  kycStatus: string;
  onNavigate: (subView: string) => void;
  /** When true, explains that draft trades are allowed until verification. */
  showDraftHint?: boolean;
  organisationDocuments?: { doc_type?: string; status?: string }[];
}

const TraderKycBanner: React.FC<TraderKycBannerProps> = ({
  kycStatus,
  onNavigate,
  showDraftHint = true,
  organisationDocuments = [],
}) => {
  if (isTraderKycVerified(kycStatus)) return null;

  const copy = getTraderKycGateCopy(kycStatus);
  const alertClass =
    copy.variant === 'info' ? 'alert alert-info' : 'alert alert-warning';

  const uploadedTypes = new Set(
    organisationDocuments
      .filter((d) => d.status && ['UPLOADED', 'UNDER_REVIEW', 'VERIFIED'].includes(d.status))
      .map((d) => d.doc_type)
      .filter(Boolean)
  );
  const missingDocs = REQUIRED_KYC_DOC_TYPES.filter((t) => !uploadedTypes.has(t));

  return (
    <div
      className={alertClass}
      style={{
        marginBottom: '20px',
        padding: '16px 18px',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div>
        <strong style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>{copy.title}</strong>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.55 }}>{copy.message}</p>
        {showDraftHint && (
          <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.55, fontWeight: 600 }}>
            You can prepare trade applications and save them as drafts. Submitting to Miziba staff requires CEO or
            Operations Admin to verify your company first.
          </p>
        )}
      </div>
      {(kycStatus === 'PENDING' || kycStatus === 'REJECTED' || kycStatus === 'FLAGGED') && missingDocs.length > 0 && (
        <div style={{ fontSize: '12px' }}>
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>Required before you can submit KYC for review:</div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {missingDocs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <Button
          variant="primary"
          size="sm"
          style={{ background: '#8B0000', border: 'none' }}
          onClick={() => onNavigate(copy.ctaView)}
        >
          {copy.ctaLabel} →
        </Button>
      </div>
    </div>
  );
};

export default TraderKycBanner;
