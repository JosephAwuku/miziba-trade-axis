import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

const allowed = (role: string | undefined) => role === 'ceo' || role === 'ops_admin';

/** Nullable user FK columns — cleared before hard delete */
const NULLABLE_USER_FK_UPDATES: { table: string; column: string }[] = [
  { table: 'trades', column: 'deal_officer_id' },
  { table: 'trades', column: 'declined_by' },
  { table: 'trades', column: 'fp_decided_by' },
  { table: 'trades', column: 'validated_by' },
  { table: 'trades', column: 'ceo_approved_by' },
  { table: 'trade_stage_log', column: 'changed_by' },
  { table: 'organisation_documents', column: 'uploaded_by' },
  { table: 'organisation_documents', column: 'reviewed_by' },
  { table: 'audit_log', column: 'user_id' },
];

/** Hard-delete blockers — user must not appear on required audit / trade records */
const REQUIRED_USER_REF_CHECKS: { table: string; column: string; label: string }[] = [
  { table: 'risk_scores', column: 'scored_by', label: 'risk assessments' },
  { table: 'ceo_escalations', column: 'escalated_by', label: 'CEO escalations' },
  { table: 'finance_data_packages', column: 'generated_by', label: 'finance data packages' },
  { table: 'fp_decisions', column: 'decided_by', label: 'finance partner decisions' },
  { table: 'non_payment_cases', column: 'created_by', label: 'non-payment cases' },
  { table: 'dispute_cases', column: 'opened_by', label: 'dispute cases' },
  { table: 'document_access_log', column: 'accessed_by', label: 'document access history' },
];

async function clearNullableUserReferences(userId: string) {
  for (const { table, column } of NULLABLE_USER_FK_UPDATES) {
    const { error } = await supabaseAdmin.from(table).update({ [column]: null }).eq(column, userId);
    if (error && !error.message.includes('does not exist')) {
      console.warn(`clearNullableUserReferences ${table}.${column}:`, error.message);
    }
  }
}

async function deleteUserFromSystem(userId: string, orgId: string, role: string) {
  for (const { table, column, label } of REQUIRED_USER_REF_CHECKS) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, userId);
    if (error && !error.message.includes('does not exist')) {
      console.warn(`deleteUserFromSystem check ${table}:`, error.message);
      continue;
    }
    if ((count ?? 0) > 0) {
      return {
        ok: false as const,
        message: `This user cannot be deleted because they are linked to ${label}. Deactivate the account instead, or contact support.`,
      };
    }
  }

  await supabaseAdmin.from('notifications').delete().eq('user_id', userId);
  await supabaseAdmin.from('idempotency_keys').delete().eq('user_id', userId);
  await supabaseAdmin.from('sessions').delete().eq('user_id', userId);
  await clearNullableUserReferences(userId);

  const { error: deleteErr } = await supabaseAdmin.from('users').delete().eq('id', userId);
  if (deleteErr) {
    console.error('users hard delete failed:', deleteErr);
    return {
      ok: false as const,
      message:
        deleteErr.message.includes('foreign key') || deleteErr.code === '23503'
          ? 'This user is linked to other platform records and cannot be deleted. Try deactivating the account instead.'
          : deleteErr.message,
    };
  }

  if (['trader', 'finance_partner'].includes(role) && orgId) {
    const { count: orgUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if ((orgUsers ?? 0) === 0) {
      const { count: traderTrades } = await supabaseAdmin
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('trader_org_id', orgId);
      const { count: fpTrades } = await supabaseAdmin
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('fp_org_id', orgId);

      if ((traderTrades ?? 0) === 0 && (fpTrades ?? 0) === 0) {
        await supabaseAdmin.from('organisations').delete().eq('id', orgId);
      }
    }
  }

  return { ok: true as const };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const typedUser = auth.profile as User;
    if (!allowed(typedUser.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { data: row, error } = await supabaseAdmin
      .from('users')
      .select(
        `
        id,
        full_name,
        email,
        phone,
        role,
        is_active,
        org_id,
        totp_enabled,
        must_change_password,
        locked_until,
        created_at,
        created_by,
        organisations!users_org_id_fkey ( id, name, kyc_status, type )
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('GET /api/admin/users/[id] error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const orgRaw = (row as any).organisations;
    const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
    return NextResponse.json({
      data: {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone ?? '',
        role: row.role,
        is_active: row.is_active,
        org_id: org?.id ?? row.org_id,
        org_name: org?.name ?? '',
        kyc_status: org?.kyc_status ?? null,
        totp_enabled: row.totp_enabled,
        must_change_password: row.must_change_password,
        locked_until: row.locked_until,
        admin_added_at: row.created_by ? row.created_at : null,
      },
    });
  } catch (e) {
    console.error('GET /api/admin/users/[id] internal error:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const actor = auth.profile as User;
    if (!allowed(actor.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : undefined;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const phone = body.phone === null || body.phone === undefined
      ? undefined
      : String(body.phone).trim() || null;
    const is_active = typeof body.is_active === 'boolean' ? body.is_active : undefined;
    const org_name = typeof body.org_name === 'string' ? body.org_name.trim() : undefined;

    if (full_name !== undefined && !full_name) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Full name cannot be empty.' }, { status: 422 });
    }
    if (email !== undefined && !email.includes('@')) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid email.' }, { status: 422 });
    }

    const { data: target, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('id, email, org_id, role')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !target) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    if (id === actor.id && is_active === false) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'You cannot deactivate your own account.' }, { status: 422 });
    }

    if (email !== undefined && email !== target.email) {
      const { data: taken } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
      if (taken && taken.id !== id) {
        return NextResponse.json({ error: 'CONFLICT', message: 'That email is already in use.' }, { status: 409 });
      }
    }

    const userPatch: Record<string, unknown> = {};
    if (full_name !== undefined) userPatch.full_name = full_name;
    if (email !== undefined) userPatch.email = email;
    if (phone !== undefined) userPatch.phone = phone;
    if (is_active !== undefined) userPatch.is_active = is_active;

    const hasUserPatch = Object.keys(userPatch).length > 0;
    const hasOrgRename =
      org_name !== undefined &&
      org_name.length > 0 &&
      target.org_id &&
      ['trader', 'finance_partner'].includes(target.role);

    if (!hasUserPatch && !hasOrgRename) {
      return NextResponse.json({ success: true, message: 'No changes applied.' });
    }

    if (hasUserPatch) {
      userPatch.updated_at = new Date().toISOString();
      const { error: upErr } = await supabaseAdmin.from('users').update(userPatch).eq('id', id);
      if (upErr) {
        return NextResponse.json({ error: 'DB_WRITE_FAILED', message: upErr.message }, { status: 500 });
      }
    }

    if (hasOrgRename) {
      const { error: orgErr } = await supabaseAdmin
        .from('organisations')
        .update({ name: org_name, updated_at: new Date().toISOString() })
        .eq('id', target.org_id);
      if (orgErr) {
        return NextResponse.json({ error: 'DB_WRITE_FAILED', message: orgErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('PATCH /api/admin/users/[id] error:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: e?.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = _request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const actor = auth.profile as User;
    if (!allowed(actor.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    if (id === actor.id) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'You cannot remove your own account.' }, { status: 422 });
    }

    const { data: target, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('id, role, is_active, org_id, email')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !target) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'User not found.' }, { status: 404 });
    }

    if (target.role === 'ceo' && target.is_active) {
      const { count, error: cntErr } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'ceo')
        .eq('is_active', true);

      if (!cntErr && (count ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Cannot delete the last active CEO account.' },
          { status: 422 }
        );
      }
    }

    const result = await deleteUserFromSystem(target.id, target.org_id, target.role);
    if (!result.ok) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: result.message }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: `${target.email} has been permanently removed from the system.`,
    });
  } catch (e: any) {
    console.error('DELETE /api/admin/users/[id] error:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: e?.message }, { status: 500 });
  }
}
