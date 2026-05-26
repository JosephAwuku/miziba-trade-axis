/** Required organisation documents before KYC can be submitted for review */
export const REQUIRED_KYC_DOC_TYPES = [
  'Certificate of Incorporation',
  'TIN Certificate',
  'Bank Statement (last 3 months)',
  'Director ID (Passport or Ghana Card)',
] as const;

export type TraderKycStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'FLAGGED'
  | 'REJECTED'
  | string;

/** True only when status is VERIFIED (use is_fully_verified from profile API for authoritative checks). */
export function isTraderKycVerified(status: string | null | undefined): boolean {
  return status === 'VERIFIED';
}

function hasCompleteCompanyData(org: {
  registration_no?: string | null;
  tin?: string | null;
  address?: string | null;
} | null | undefined): boolean {
  return !!(org?.registration_no?.trim() && org?.tin?.trim() && org?.address?.trim());
}

function hasCompleteBankData(profile: {
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_branch?: string | null;
  bank_swift?: string | null;
} | null | undefined): boolean {
  return !!(
    profile?.bank_name?.trim() &&
    profile?.bank_account_number?.trim() &&
    profile?.bank_account_branch?.trim() &&
    profile?.bank_swift?.trim()
  );
}

function allRequiredDocsVerified(
  documents: Array<{ docType: string; status: string }>
): boolean {
  return REQUIRED_KYC_DOC_TYPES.every((type) =>
    documents.some((d) => d.docType === type && d.status === 'VERIFIED')
  );
}

export function getTraderKycGateCopy(status: string | null | undefined): {
  title: string;
  message: string;
  ctaLabel: string;
  ctaView: 'company';
  variant: 'warning' | 'info' | 'success';
} {
  switch (status) {
    case 'VERIFIED':
      return {
        title: 'Company verified',
        message: 'You can submit trade applications.',
        ctaLabel: 'New trade application',
        ctaView: 'company',
        variant: 'success',
      };
    case 'UNDER_REVIEW':
      return {
        title: 'KYC under review',
        message:
          'Your company verification is with our compliance team (typically 24–48 hours). Save trade work as drafts until you are approved.',
        ctaLabel: 'View company profile',
        ctaView: 'company',
        variant: 'info',
      };
    case 'REJECTED':
      return {
        title: 'Verification needs updates',
        message:
          'Your KYC was not approved. Update your documents and resubmit for review. Trade drafts can be saved but not submitted to Miziba.',
        ctaLabel: 'Update company profile',
        ctaView: 'company',
        variant: 'warning',
      };
    default:
      return {
        title: 'Company verification required',
        message:
          'Complete company verification (profile, documents, and bank details), submit for review, and wait for CEO or Operations Admin approval.',
        ctaLabel: 'Complete company profile',
        ctaView: 'company',
        variant: 'warning',
      };
  }
}

export async function getTraderOrgKycStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  orgId: string
): Promise<string> {
  const { data, error } = await admin
    .from('organisations')
    .select('kyc_status')
    .eq('id', orgId)
    .single();

  if (error || !data) return 'PENDING';
  return data.kyc_status || 'PENDING';
}

export async function assertTraderCanSubmitTrades(
  admin: any,
  orgId: string
): Promise<{ ok: true } | { ok: false; status: string; message: string }> {
  const check = await assertTraderFullyVerified(admin, orgId);
  if (check.ok) {
    return { ok: true };
  }
  const effectiveStatus = check.details?.kyc_status || (await getTraderOrgKycStatus(admin, orgId));
  const copy = getTraderKycGateCopy(effectiveStatus);
  return {
    ok: false,
    status: effectiveStatus,
    message: check.reason || copy.message,
  };
}

export async function assertRequiredKycDocumentsUploaded(
  admin: any,
  orgId: string
): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  const { data: docs, error } = await admin
    .from('organisation_documents')
    .select('doc_type, status')
    .eq('org_id', orgId);

  if (error) {
    return { ok: false, missing: [...REQUIRED_KYC_DOC_TYPES] };
  }

  const uploaded = new Set(
    (docs || [])
      .filter((d: { status: string }) => d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW' || d.status === 'VERIFIED')
      .map((d: { doc_type: string }) => d.doc_type)
  );

  const missing = REQUIRED_KYC_DOC_TYPES.filter((t) => !uploaded.has(t));
  if (missing.length) return { ok: false, missing: [...missing] };
  return { ok: true };
}

/**
 * Get comprehensive verification status breakdown for a trader.
 * Returns what's complete, pending, and missing for proper verification flow.
 */
export async function getTraderVerificationStatus(
  admin: any,
  orgId: string
): Promise<{
  isFullyVerified: boolean;
  kyc_status: string;
  companyProfile: {
    isVerified: boolean;
    hasData: boolean;
    verifiedBy: string | null;
    verifiedAt: string | null;
    rejectionNotes: string | null;
  };
  bankDetails: {
    isVerified: boolean;
    hasData: boolean;
    verifiedBy: string | null;
    verifiedAt: string | null;
    rejectionNotes: string | null;
  };
  documents: Array<{
    id: string;
    docType: string;
    name: string;
    status: string;
    rejectionNotes: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
  }>;
  requiredDocuments: {
    total: number;
    uploaded: number;
    verified: number;
    rejected: number;
    missing: string[];
  };
}> {
  // Base org fields (always present)
  const { data: org } = await admin
    .from('organisations')
    .select('kyc_status, registration_no, tin, address, kyc_verified_at, kyc_verified_by')
    .eq('id', orgId)
    .single();

  // Granular verification columns (migration 0008 — optional until applied)
  const orgGranularRes = await admin
    .from('organisations')
    .select('company_profile_verified, company_profile_verified_by, company_profile_verified_at, company_profile_rejection_notes')
    .eq('id', orgId)
    .maybeSingle();
  const orgGranular = orgGranularRes.error ? null : orgGranularRes.data;

  const { data: profile } = await admin
    .from('trader_profiles')
    .select('bank_name, bank_account_number, bank_account_branch, bank_swift')
    .eq('org_id', orgId)
    .maybeSingle();

  const profileGranularRes = await admin
    .from('trader_profiles')
    .select('bank_details_verified, bank_details_verified_by, bank_details_verified_at, bank_details_rejection_notes')
    .eq('org_id', orgId)
    .maybeSingle();
  const profileGranular = profileGranularRes.error ? null : profileGranularRes.data;

  // Get documents (rejection_notes column optional until migration 0008)
  const { data: docs } = await admin
    .from('organisation_documents')
    .select('id, doc_type, name, status, reviewed_by, reviewed_at')
    .eq('org_id', orgId);

  let docRejectionNotes: Record<string, string | null> = {};
  if (docs?.length) {
    const docsWithNotesRes = await admin
      .from('organisation_documents')
      .select('id, rejection_notes')
      .eq('org_id', orgId);
    if (!docsWithNotesRes.error && docsWithNotesRes.data) {
      docRejectionNotes = Object.fromEntries(
        docsWithNotesRes.data.map((d: { id: string; rejection_notes?: string | null }) => [d.id, d.rejection_notes ?? null])
      );
    }
  }

  const kyc_status = org?.kyc_status || 'PENDING';

  const hasCompanyData = hasCompleteCompanyData(org);
  const companyProfileVerified = orgGranular?.company_profile_verified === true;

  const hasBankData = hasCompleteBankData(profile);
  const bankDetailsVerified = profileGranular?.bank_details_verified === true;

  // Documents analysis
  type DocEntry = { id: string; docType: string; name: string; status: string; rejectionNotes: string | null; reviewedBy: string | null; reviewedAt: string | null };
  const documents: DocEntry[] = (docs || []).map((d: { id: string; doc_type: string; name: string; status: string; reviewed_by?: string | null; reviewed_at?: string | null }) => ({
    id: d.id,
    docType: d.doc_type,
    name: d.name,
    status: d.status,
    rejectionNotes: docRejectionNotes[d.id] ?? null,
    reviewedBy: d.reviewed_by || null,
    reviewedAt: d.reviewed_at || null,
  }));

  const uploadedDocs = new Set(documents.map(d => d.docType));
  const verifiedDocs = documents.filter(d => d.status === 'VERIFIED');
  const rejectedDocs = documents.filter(d => d.status === 'REJECTED');
  const missingRequiredDocs = REQUIRED_KYC_DOC_TYPES.filter(t => !uploadedDocs.has(t));

  // Check if any documents are pending or rejected
  const hasPendingDocs = documents.some(d => d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW');
  const hasRejectedDocs = rejectedDocs.length > 0;
  const hasAllRequiredDocs = missingRequiredDocs.length === 0;

  // Fully verified only when every required item is submitted AND admin-approved.
  const isFullyVerified =
    hasCompanyData &&
    hasBankData &&
    companyProfileVerified &&
    bankDetailsVerified &&
    hasAllRequiredDocs &&
    allRequiredDocsVerified(documents) &&
    !hasPendingDocs &&
    !hasRejectedDocs;

  return {
    isFullyVerified,
    kyc_status,
    companyProfile: {
      isVerified: companyProfileVerified,
      hasData: hasCompanyData,
      verifiedBy: orgGranular?.company_profile_verified_by || null,
      verifiedAt: orgGranular?.company_profile_verified_at || null,
      rejectionNotes: orgGranular?.company_profile_rejection_notes || null,
    },
    bankDetails: {
      isVerified: bankDetailsVerified,
      hasData: hasBankData,
      verifiedBy: profileGranular?.bank_details_verified_by || null,
      verifiedAt: profileGranular?.bank_details_verified_at || null,
      rejectionNotes: profileGranular?.bank_details_rejection_notes || null,
    },
    documents,
    requiredDocuments: {
      total: REQUIRED_KYC_DOC_TYPES.length,
      uploaded: uploadedDocs.size,
      verified: verifiedDocs.length,
      rejected: rejectedDocs.length,
      missing: [...missingRequiredDocs],
    },
  };
}

/**
 * Check if trader can submit trades based on comprehensive verification status
 */
export async function assertTraderFullyVerified(
  admin: any,
  orgId: string
): Promise<{ ok: true } | { ok: false; reason: string; details: any }> {
  const status = await getTraderVerificationStatus(admin, orgId);
  
  if (status.isFullyVerified) {
    return { ok: true };
  }

  // Build detailed reason
  const issues = [];
  
  if (!status.companyProfile.isVerified) {
    if (!status.companyProfile.hasData) {
      issues.push('Company profile data not submitted');
    } else if (status.companyProfile.rejectionNotes) {
      issues.push(`Company profile rejected: ${status.companyProfile.rejectionNotes}`);
    } else {
      issues.push('Company profile awaiting admin approval');
    }
  }

  if (!status.bankDetails.isVerified) {
    if (!status.bankDetails.hasData) {
      issues.push('Bank details not submitted');
    } else if (status.bankDetails.rejectionNotes) {
      issues.push(`Bank details rejected: ${status.bankDetails.rejectionNotes}`);
    } else {
      issues.push('Bank details awaiting admin approval');
    }
  }

  if (status.requiredDocuments.missing.length > 0) {
    issues.push(`Missing required documents: ${status.requiredDocuments.missing.join(', ')}`);
  }

  const rejectedDocs = status.documents.filter(d => d.status === 'REJECTED');
  if (rejectedDocs.length > 0) {
    issues.push(`${rejectedDocs.length} document(s) rejected and need resubmission`);
  }

  const pendingDocs = status.documents.filter(d => d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW');
  if (pendingDocs.length > 0) {
    issues.push(`${pendingDocs.length} document(s) awaiting admin review`);
  }

  return {
    ok: false,
    reason: issues.join('; '),
    details: status,
  };
}

/**
 * Sync organisations.kyc_status with actual verification state.
 * Downgrades stale VERIFIED rows (e.g. from testing) when data is incomplete.
 */
export async function reconcileTraderKycStatus(
  admin: any,
  orgId: string
): Promise<{
  kyc_status: string;
  isFullyVerified: boolean;
  verification: Awaited<ReturnType<typeof getTraderVerificationStatus>>;
}> {
  const verification = await getTraderVerificationStatus(admin, orgId);
  let targetStatus = verification.kyc_status;

  if (verification.isFullyVerified) {
    targetStatus = 'VERIFIED';
  } else if (verification.kyc_status === 'VERIFIED') {
    const hasAnyRejection =
      !!verification.companyProfile.rejectionNotes ||
      !!verification.bankDetails.rejectionNotes ||
      verification.documents.some((d) => d.status === 'REJECTED');

    const hasSubmission =
      verification.companyProfile.hasData ||
      verification.bankDetails.hasData ||
      verification.documents.length > 0;

    targetStatus = hasAnyRejection ? 'REJECTED' : hasSubmission ? 'UNDER_REVIEW' : 'PENDING';
  }

  if (targetStatus !== verification.kyc_status) {
    const now = new Date().toISOString();
    await admin
      .from('organisations')
      .update({
        kyc_status: targetStatus,
        kyc_verified_at: targetStatus === 'VERIFIED' ? now : null,
        kyc_verified_by: targetStatus === 'VERIFIED' ? undefined : null,
        updated_at: now,
      })
      .eq('id', orgId);

    verification.kyc_status = targetStatus;
  }

  return {
    kyc_status: targetStatus,
    isFullyVerified: verification.isFullyVerified,
    verification,
  };
}
