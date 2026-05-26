/**
 * Transactional email via Resend (https://resend.com).
 * Server-only — never import from client components.
 */

import * as React from 'react';
import { render } from 'react-email';
import { Resend } from 'resend';

import TradeAxisAccountActivationEmail from '@/emails/tradeaxis-account-activation';

let resendSingleton: Resend | null = null;

export function getAppBaseUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

/** Must match a verified sender domain in Resend (e.g. "TradeAxis <hello@yourdomain.com>"). */
export function getEmailFrom(): string | undefined {
  const from = process.env.EMAIL_FROM?.trim();
  return from || undefined;
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim() && !!getEmailFrom();
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resendSingleton) resendSingleton = new Resend(key);
  return resendSingleton;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapEmailHtml(inner: string, recipientName?: string | null): string {
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : '';
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;padding:32px 24px;">
<p style="font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#8b0000;margin:0 0 24px;">TradeAxis</p>
${greeting ? `<p style="margin:0 0 16px;">${greeting}</p>` : ''}
${inner}
<p style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
  © TradeAxis · Miziba Trade Finance Platform<br/>
  You received this message because you have an active TradeAxis account.
</p>
</body></html>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; id?: string; skipped?: boolean; error?: string }> {
  const from = getEmailFrom();
  const resend = getResend();
  if (!from || !resend) {
    console.warn('[email] RESEND_API_KEY or EMAIL_FROM missing — skipping send.');
    return { ok: false, skipped: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      console.error('[email] Resend API error:', error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] send failed:', msg);
    return { ok: false, error: msg };
  }
}

function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Welcome email after CEO/Ops creates an account via POST /api/admin/invite */
export async function sendInviteWelcomeEmail(opts: {
  to: string;
  recipientName: string;
  role: string;
  orgName: string;
  temporaryPassword: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string; id?: string }> {
  const loginUrl = `${getAppBaseUrl()}/`;
  const roleLabel = formatRoleLabel(opts.role);

  const props = {
    recipientName: opts.recipientName,
    loginEmail: opts.to.trim(),
    temporaryPassword: opts.temporaryPassword,
    roleLabel,
    orgName: opts.orgName,
    loginUrl,
  };

  const html = await render(React.createElement(TradeAxisAccountActivationEmail, props));
  const text = await render(React.createElement(TradeAxisAccountActivationEmail, props), {
    plainText: true,
  });

  return sendEmail({ to: opts.to, subject: 'Activate your TradeAxis account', html, text });
}

/** Mirrors an in-app notification to the user inbox (best-effort). */
export async function sendNotificationEmail(opts: {
  to: string;
  recipientName?: string | null;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const safeSubject = escapeHtml(opts.subject);
  const bodyHtml = escapeHtml(opts.body).replace(/\r\n/g, '\n').replace(/\n/g, '<br />');
  const appUrl = escapeHtml(getAppBaseUrl() + '/');

  const html = wrapEmailHtml(
    `<h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px;">${safeSubject}</h2>
<p style="margin:0 0 20px;color:#374151;">${bodyHtml}</p>
<a href="${appUrl}" style="display:inline-block;background:#8b0000;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 22px;border-radius:6px;">Open TradeAxis →</a>`,
    opts.recipientName,
  );

  const name = opts.recipientName ? `Hi ${opts.recipientName},\n\n` : '';
  const text = `${name}${opts.subject}\n\n${opts.body}\n\nOpen TradeAxis: ${getAppBaseUrl()}/`;

  return sendEmail({ to: opts.to, subject: opts.subject, html, text });
}
