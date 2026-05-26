import { isResendConfigured, sendNotificationEmail } from './email';
import { KYC_APPROVER_ROLES } from './kyc-approvers';

/** Miziba roles that receive new trade intake alerts (before a deal officer is assigned). */
export const NEW_TRADE_NOTIFY_ROLES = ['ceo', 'ops_admin', 'deal_officer'] as const;

/** Miziba roles that receive trader KYC upload alerts — must match KYC approvers. */
export const KYC_INTAKE_NOTIFY_ROLES = KYC_APPROVER_ROLES;

export type TradeNotificationAudience =
  | 'all_participants'
  | 'trader_and_officer'
  | 'officer_only';

type NotificationPayload = {
  subject: string;
  body: string;
  type: string;
  tradeId?: string;
  excludeUserId?: string;
};

const TRADE_PARTICIPANT_FIELDS = 'id, deal_officer_id, trader_org_id, fp_org_id, trade_ref';

async function getActiveUserIdsByRoles(admin: any, roles: string[]): Promise<string[]> {
  const { data: users, error } = await admin
    .from('users')
    .select('id')
    .in('role', roles)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to resolve notification recipients by role:', error);
    return [];
  }

  return (users || []).map((u: { id: string }) => u.id);
}

async function getActiveOrgUserIds(admin: any, orgId: string, role?: string): Promise<string[]> {
  let query = admin.from('users').select('id').eq('org_id', orgId).eq('is_active', true);
  if (role) query = query.eq('role', role);

  const { data: users, error } = await query;
  if (error) {
    console.error('Failed to resolve org notification recipients:', error);
    return [];
  }

  return (users || []).map((u: { id: string }) => u.id);
}

async function resolveTradeForNotification(
  admin: any,
  trade: { id?: string; deal_officer_id?: string | null; trader_org_id?: string | null; fp_org_id?: string | null; trade_ref?: string }
) {
  const needsLookup =
    Boolean(trade?.id) &&
    trade.deal_officer_id === undefined &&
    trade.trader_org_id === undefined &&
    trade.fp_org_id === undefined;

  if (!needsLookup) return trade;

  const { data, error } = await admin
    .from('trades')
    .select(TRADE_PARTICIPANT_FIELDS)
    .eq('id', trade.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to resolve trade notification participants:', error);
    return trade;
  }

  return data ? { ...trade, ...data } : trade;
}

async function resolveTradeParticipantUserIds(
  admin: any,
  trade: { id?: string; deal_officer_id?: string | null; trader_org_id?: string | null; fp_org_id?: string | null },
  audience: TradeNotificationAudience = 'all_participants'
): Promise<string[]> {
  const resolved = await resolveTradeForNotification(admin, trade);
  const userIds = new Set<string>();

  if (audience === 'officer_only' || audience === 'trader_and_officer' || audience === 'all_participants') {
    if (resolved.deal_officer_id) userIds.add(resolved.deal_officer_id);
  }

  if (audience === 'officer_only') {
    return Array.from(userIds);
  }

  if (resolved.trader_org_id) {
    const traderUsers = await getActiveOrgUserIds(admin, resolved.trader_org_id, 'trader');
    traderUsers.forEach(id => userIds.add(id));
  }

  if (audience === 'all_participants' && resolved.fp_org_id) {
    const fpUsers = await getActiveOrgUserIds(admin, resolved.fp_org_id, 'finance_partner');
    fpUsers.forEach(id => userIds.add(id));
  }

  return Array.from(userIds);
}

export async function createNotification(
  admin: any,
  {
    userId,
    tradeId,
    subject,
    body,
    type
  }: {
    userId: string;
    tradeId?: string;
    subject: string;
    body: string;
    type: string;
  }
) {
  try {
    const { data: recipient } = await admin
      .from('users')
      .select('email, full_name, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (!recipient || recipient.is_active === false) return;

    const row: Record<string, unknown> = {
      user_id: userId,
      trade_id: tradeId ?? null,
      subject: subject ?? '',
      body,
      created_at: new Date().toISOString(),
    };
    if (type) row.type = type;

    const { error } = await admin.from('notifications').insert(row);

    if (error) throw error;

    const mirror =
      process.env.EMAIL_MIRROR_NOTIFICATIONS !== 'false' &&
      process.env.EMAIL_MIRROR_NOTIFICATIONS !== '0';
    if (
      mirror &&
      isResendConfigured() &&
      recipient &&
      typeof recipient.email === 'string' &&
      recipient.email.includes('@')
    ) {
      sendNotificationEmail({
        to: recipient.email,
        recipientName: recipient.full_name,
        subject: subject || 'TradeAxis notification',
        body,
      }).catch((err) => console.error('[email] notification mirror failed:', err));
    }
  } catch (err) {
    console.error('Failed to create notification:', err);
    // Don't fail the main request because a notification failed
  }
}

async function dispatchNotifications(
  admin: any,
  userIds: string[],
  payload: NotificationPayload
) {
  const recipients = payload.excludeUserId
    ? userIds.filter(id => id !== payload.excludeUserId)
    : userIds;

  await Promise.all(
    recipients.map(userId =>
      createNotification(admin, {
        userId,
        tradeId: payload.tradeId,
        subject: payload.subject,
        body: payload.body,
        type: payload.type,
      })
    )
  );
}

/**
 * Trade lifecycle alerts: assigned deal officer, trader org, and assigned finance partner.
 */
export async function notifyTradeParticipants(
  admin: any,
  trade: any,
  {
    subject,
    body,
    type,
    excludeUserId,
    audience = 'all_participants',
  }: NotificationPayload & { audience?: TradeNotificationAudience }
) {
  try {
    const resolved = await resolveTradeForNotification(admin, trade);
    const userIds = await resolveTradeParticipantUserIds(admin, resolved, audience);
    await dispatchNotifications(admin, userIds, {
      subject,
      body,
      type,
      tradeId: resolved.id,
      excludeUserId,
    });
  } catch (err) {
    console.error('Failed to notify trade participants:', err);
  }
}

/**
 * Internal Miziba role alerts — only users with the specified roles receive these.
 */
export async function notifyInternalRoles(
  admin: any,
  roles: string[],
  { subject, body, type, tradeId, excludeUserId }: NotificationPayload
) {
  try {
    const userIds = await getActiveUserIdsByRoles(admin, roles);
    await dispatchNotifications(admin, userIds, {
      subject,
      body,
      type,
      tradeId,
      excludeUserId,
    });
  } catch (err) {
    console.error('Failed to notify internal roles:', err);
  }
}

/** New trade submitted — internal intake team only (not traders or finance partners). */
export async function notifyNewTradeSubmission(
  admin: any,
  payload: { tradeId: string; subject: string; body: string; type: string; excludeUserId?: string }
) {
  await notifyInternalRoles(admin, [...NEW_TRADE_NOTIFY_ROLES], payload);
}

/** KYC submitted — verification intake team only. */
export async function notifyKycSubmission(
  admin: any,
  payload: { subject: string; body: string; type: string; excludeUserId?: string }
) {
  await notifyInternalRoles(admin, [...KYC_INTAKE_NOTIFY_ROLES], payload);
}

/** Settlement / treasury alerts — finance officer and executive oversight only. */
export async function notifySettlementRoles(
  admin: any,
  roles: Array<'cfo' | 'ceo' | 'deal_officer'>,
  payload: NotificationPayload
) {
  await notifyInternalRoles(admin, roles, payload);
}

/** CEO-only action alerts (escalations, validated trade review). */
export async function notifyCeoAction(
  admin: any,
  payload: NotificationPayload
) {
  await notifyInternalRoles(admin, ['ceo'], payload);
}

/** Trader org only — e.g. KYC decision outcomes. */
export async function notifyTraderOrg(
  admin: any,
  orgId: string,
  payload: Omit<NotificationPayload, 'tradeId'>
) {
  try {
    const userIds = await getActiveOrgUserIds(admin, orgId, 'trader');
    await dispatchNotifications(admin, userIds, payload);
  } catch (err) {
    console.error('Failed to notify trader org:', err);
  }
}
