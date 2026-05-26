import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey);

// Inline reconcile logic (mirrors lib/trader-kyc.ts) for script use
const REQUIRED = [
  'Certificate of Incorporation',
  'TIN Certificate',
  'Bank Statement (last 3 months)',
  'Director ID (Passport or Ghana Card)',
];

async function reconcileOrg(orgId, orgName) {
  const { data: org } = await admin.from('organisations').select('*').eq('id', orgId).single();
  const { data: profile } = await admin.from('trader_profiles').select('*').eq('org_id', orgId).maybeSingle();
  const { data: docs } = await admin.from('organisation_documents').select('*').eq('org_id', orgId);

  const hasCompany = !!(org?.registration_no?.trim() && org?.tin?.trim() && org?.address?.trim());
  const hasBank = !!(
    profile?.bank_name?.trim() &&
    profile?.bank_account_number?.trim() &&
    profile?.bank_account_branch?.trim() &&
    profile?.bank_swift?.trim()
  );
  const companyVerified = org?.company_profile_verified === true;
  const bankVerified = profile?.bank_details_verified === true;
  const docList = docs || [];
  const allDocsVerified = REQUIRED.every((t) => docList.some((d) => d.doc_type === t && d.status === 'VERIFIED'));
  const hasRejected = docList.some((d) => d.status === 'REJECTED');
  const hasPending = docList.some((d) => d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW');

  const isFullyVerified =
    hasCompany && hasBank && companyVerified && bankVerified && allDocsVerified && !hasRejected && !hasPending;

  let target = org.kyc_status;
  if (isFullyVerified) {
    target = 'VERIFIED';
  } else if (org.kyc_status === 'VERIFIED') {
    const hasSubmission = hasCompany || hasBank || docList.length > 0;
    const hasRejection = hasRejected || org.company_profile_rejection_notes || profile?.bank_details_rejection_notes;
    target = hasRejection ? 'REJECTED' : hasSubmission ? 'UNDER_REVIEW' : 'PENDING';
  }

  if (target !== org.kyc_status) {
    await admin
      .from('organisations')
      .update({
        kyc_status: target,
        kyc_verified_at: target === 'VERIFIED' ? new Date().toISOString() : null,
        kyc_verified_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);
    console.log(`✓ ${orgName}: ${org.kyc_status} → ${target}`);
  } else {
    console.log(`  ${orgName}: ${org.kyc_status} (no change)`);
  }
}

async function main() {
  const { data: traders, error } = await admin.from('organisations').select('id, name, kyc_status').eq('type', 'trader');
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`Reconciling ${traders.length} trader organisation(s)...\n`);
  for (const t of traders) {
    await reconcileOrg(t.id, t.name);
  }
  console.log('\nDone.');
}

main();
