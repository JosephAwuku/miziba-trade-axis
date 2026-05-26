import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { notifyTraderOrg } from '@/lib/notifications';
import { isKycApproverRole } from '@/lib/kyc-approvers';
import { getTraderVerificationStatus } from '@/lib/trader-kyc';

export const dynamic = 'force-dynamic';

/**
 * GRANULAR KYC VERIFICATION API
 * 
 * Supports individual approval/rejection of:
 * - Company profile data (registration_no, TIN, address)
 * - Bank details (bank_name, account_number, swift, etc.)
 * - Individual documents (one at a time)
 * 
 * Trader is only marked as VERIFIED when ALL items are approved.
 */

type VerificationTarget = 'document' | 'company_profile' | 'bank_details' | 'full_verification';
type VerificationDecision = 'approve' | 'reject';

interface VerificationRequest {
  org_id: string;
  target: VerificationTarget;
  decision: VerificationDecision;
  notes?: string;
  // For document verification
  document_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || !isKycApproverRole(auth.profile.role)) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'You are not allowed to approve trader KYC.' },
        { status: 403 }
      );
    }

    const body = await request.json() as VerificationRequest;
    const { org_id, target, decision, notes, document_id } = body;

    if (!org_id || !target || !decision) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }

    if (decision === 'reject' && !notes?.trim()) {
      return NextResponse.json(
        { error: 'REJECTION_NOTES_REQUIRED', message: 'Please provide notes when rejecting.' },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin;
    const now = new Date().toISOString();
    const adminId = auth.profile.id;

    // Handle different verification targets
    switch (target) {
      case 'document':
        if (!document_id) {
          return NextResponse.json({ error: 'MISSING_DOCUMENT_ID' }, { status: 400 });
        }
        
        await admin
          .from('organisation_documents')
          .update({
            status: decision === 'approve' ? 'VERIFIED' : 'REJECTED',
            reviewed_by: adminId,
            reviewed_at: now,
            rejection_notes: decision === 'reject' ? notes : null,
            updated_at: now,
          })
          .eq('id', document_id)
          .eq('org_id', org_id);
        
        break;

      case 'company_profile':
        await admin
          .from('organisations')
          .update({
            company_profile_verified: decision === 'approve',
            company_profile_verified_by: adminId,
            company_profile_verified_at: decision === 'approve' ? now : null,
            company_profile_rejection_notes: decision === 'reject' ? notes : null,
            updated_at: now,
          })
          .eq('id', org_id);
        
        break;

      case 'bank_details':
        await admin
          .from('trader_profiles')
          .update({
            bank_details_verified: decision === 'approve',
            bank_details_verified_by: adminId,
            bank_details_verified_at: decision === 'approve' ? now : null,
            bank_details_rejection_notes: decision === 'reject' ? notes : null,
            updated_at: now,
          })
          .eq('org_id', org_id);
        
        break;

      case 'full_verification':
        // Legacy bulk approval - only use if explicitly requested
        // This approves everything at once (old behavior)
        if (decision === 'approve') {
          await admin.from('organisations').update({
            company_profile_verified: true,
            company_profile_verified_by: adminId,
            company_profile_verified_at: now,
            company_profile_rejection_notes: null,
            updated_at: now,
          }).eq('id', org_id);

          await admin.from('trader_profiles').update({
            bank_details_verified: true,
            bank_details_verified_by: adminId,
            bank_details_verified_at: now,
            bank_details_rejection_notes: null,
            updated_at: now,
          }).eq('org_id', org_id);

          await admin.from('organisation_documents').update({
            status: 'VERIFIED',
            reviewed_by: adminId,
            reviewed_at: now,
            rejection_notes: null,
            updated_at: now,
          }).eq('org_id', org_id);
        } else {
          // Reject all
          await admin.from('organisation_documents').update({
            status: 'REJECTED',
            reviewed_by: adminId,
            reviewed_at: now,
            rejection_notes: notes || 'Verification not approved',
            updated_at: now,
          }).eq('org_id', org_id);
        }
        break;
    }

    // After any verification action, check comprehensive status
    const verificationStatus = await getTraderVerificationStatus(admin, org_id);

    // Auto-update KYC status based on comprehensive verification
    let newKycStatus: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';
    
    if (verificationStatus.isFullyVerified) {
      // Everything is approved - mark as VERIFIED
      newKycStatus = 'VERIFIED';
    } else if (
      verificationStatus.companyProfile.rejectionNotes ||
      verificationStatus.bankDetails.rejectionNotes ||
      verificationStatus.documents.some(d => d.status === 'REJECTED')
    ) {
      // Something is rejected - mark as REJECTED so trader can fix it
      newKycStatus = 'REJECTED';
    } else if (
      verificationStatus.documents.some(d => d.status === 'UNDER_REVIEW' || d.status === 'UPLOADED')
    ) {
      // Some items still under review
      newKycStatus = 'UNDER_REVIEW';
    } else {
      // Not enough data submitted
      newKycStatus = 'PENDING';
    }

    // Update the KYC status
    await admin
      .from('organisations')
      .update({
        kyc_status: newKycStatus,
        kyc_verified_at: newKycStatus === 'VERIFIED' ? now : null,
        kyc_verified_by: newKycStatus === 'VERIFIED' ? adminId : null,
        updated_at: now,
      })
      .eq('id', org_id);

    // Notify trader if status changed to VERIFIED or REJECTED
    if (newKycStatus === 'VERIFIED') {
      await notifyTraderOrg(admin, org_id, {
        subject: 'Company verification approved ✓',
        body: 'Your company verification is complete. All documents and details have been approved. You may now submit trade applications.',
        type: 'KYC_VERIFIED',
      });
    } else if (newKycStatus === 'REJECTED' && decision === 'reject') {
      // Build detailed rejection message
      const rejectionDetails = [];
      if (target === 'document' && document_id) {
        const doc = verificationStatus.documents.find(d => d.id === document_id);
        if (doc) {
          rejectionDetails.push(`Document "${doc.docType}": ${notes}`);
        }
      } else if (target === 'company_profile') {
        rejectionDetails.push(`Company profile: ${notes}`);
      } else if (target === 'bank_details') {
        rejectionDetails.push(`Bank details: ${notes}`);
      }

      await notifyTraderOrg(admin, org_id, {
        subject: 'Verification requires updates',
        body: `Your company verification needs attention. ${rejectionDetails.join('; ')}. Please update the rejected items and resubmit.`,
        type: 'KYC_REJECTED',
      });
    }

    return NextResponse.json({
      success: true,
      message: `${target.replace('_', ' ')} ${decision === 'approve' ? 'approved' : 'rejected'} successfully.`,
      kycStatus: newKycStatus,
      isFullyVerified: verificationStatus.isFullyVerified,
    });

  } catch (error) {
    console.error('POST /api/admin/verify-item error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
