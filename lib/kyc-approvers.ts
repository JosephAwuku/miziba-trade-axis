import type { Role } from './types';

/** Roles that may review trader KYC submissions and approve or disqualify */
export const KYC_APPROVER_ROLES = ['ceo', 'ops_admin'] as const satisfies readonly Role[];

export type KycApproverRole = (typeof KYC_APPROVER_ROLES)[number];

export function isKycApproverRole(role: string | null | undefined): role is KycApproverRole {
  return role != null && (KYC_APPROVER_ROLES as readonly string[]).includes(role);
}
