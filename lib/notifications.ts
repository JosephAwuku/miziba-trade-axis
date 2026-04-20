import { supabaseAdmin } from './supabase';

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
    const { error } = await admin
      .from('notifications')
      .insert({
        user_id: userId,
        trade_id: tradeId || null,
        subject,
        body,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (err) {
    console.error('Failed to create notification:', err);
    // Don't fail the main request because a notification failed
  }
}

/**
 * Convenience helper to notify multiple roles involved in a trade
 */
export async function notifyTradeParticipants(
  admin: any,
  trade: any,
  { subject, body, type, excludeUserId }: { subject: string, body: string, type: string, excludeUserId?: string }
) {
  const userIds = new Set<string>();
  
  // 1. Add Deal Officer
  if (trade.deal_officer_id) userIds.add(trade.deal_officer_id);
  
  // 2. Add Trader (need to find users in the trader org)
  if (trade.trader_org_id) {
    const { data: traderUsers } = await admin.from('users').select('id').eq('org_id', trade.trader_org_id);
    traderUsers?.forEach((u: any) => userIds.add(u.id));
  }

  // 3. Add Finance Partner (if assigned)
  if (trade.fp_org_id) {
    const { data: fpUsers } = await admin.from('users').select('id').eq('org_id', trade.fp_org_id);
    fpUsers?.forEach((u: any) => userIds.add(u.id));
  }

  // Create notifications in parallel
  const notifications = Array.from(userIds)
    .filter(id => id !== excludeUserId)
    .map(id => createNotification(admin, { userId: id, tradeId: trade.id, subject, body, type }));

  await Promise.all(notifications);
}

/**
 * Notifies all users with specified internal roles
 */
export async function notifyInternalRoles(
  admin: any,
  roles: string[],
  { subject, body, type, tradeId, excludeUserId }: { subject: string, body: string, type: string, tradeId?: string, excludeUserId?: string }
) {
  try {
    const { data: internalUsers } = await admin
      .from('users')
      .select('id')
      .in('role', roles);

    if (!internalUsers) return;

    const notifications = internalUsers
      .filter((u: any) => u.id !== excludeUserId)
      .map((u: any) => createNotification(admin, { userId: u.id, tradeId, subject, body, type }));

    await Promise.all(notifications);
  } catch (err) {
    console.error('Failed to notify internal roles:', err);
  }
}

