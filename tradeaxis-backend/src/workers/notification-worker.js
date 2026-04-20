'use strict';

/**
 * TRADEAXIS — NOTIFICATION WORKER
 * SQS consumer that dispatches email, SMS, and in-app notifications.
 * Run as a separate ECS task (not inline with the API).
 *
 * Queue: tradeaxis-notifications
 * DLQ:   tradeaxis-notifications-dlq (max 3 retries)
 *
 * Start: node src/workers/notification-worker.js
 */

require('dotenv').config();

const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { Pool } = require('pg');

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-west-1' });

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  max: 5,
});

const QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL;
const FROM_ADDRESS = process.env.SES_FROM || 'noreply@tradeaxis.miziba.com';
const POLL_INTERVAL_MS = 1000;
const MAX_MESSAGES = 10;

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────

function buildEmailBody(notification) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#F4F5F7;margin:0;padding:20px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #E2E5EA">
  <div style="background:#0D1F3C;padding:20px 24px;display:flex;align-items:center;gap:12px">
    <div style="width:32px;height:32px;background:#8B0000;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px">T</div>
    <span style="color:#fff;font-size:14px;font-weight:600">TradeAxis · Miziba Infrastructure</span>
  </div>
  <div style="padding:24px">
    ${notification.subject ? `<h2 style="color:#111827;font-size:16px;margin:0 0 12px">${notification.subject}</h2>` : ''}
    <p style="color:#4B5563;font-size:13px;line-height:1.7;margin:0 0 20px">${notification.body}</p>
    ${notification.trade_id ? `
    <a href="https://tradeaxis.miziba.com" style="display:inline-block;background:#8B0000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:7px;font-size:13px;font-weight:500">
      View in TradeAxis →
    </a>` : ''}
  </div>
  <div style="padding:16px 24px;border-top:1px solid #E2E5EA;font-size:11px;color:#9CA3AF">
    Miziba Infrastructure Ltd · Confidential · <a href="https://tradeaxis.miziba.com" style="color:#9CA3AF">tradeaxis.miziba.com</a>
  </div>
</div>
</body>
</html>`;
}

// ─── DISPATCH ─────────────────────────────────────────────────────────────────

async function dispatchNotification(notification) {
  const { id, channel, user_id } = notification;

  if (channel === 'email') {
    // Fetch user email
    const userResult = await db.query('SELECT email, full_name FROM users WHERE id=$1', [user_id]);
    if (!userResult.rows.length) {
      throw new Error(`User not found: ${user_id}`);
    }
    const { email, full_name } = userResult.rows[0];

    const command = new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [`${full_name} <${email}>`] },
      Message: {
        Subject: { Data: notification.subject || 'TradeAxis Notification', Charset: 'UTF-8' },
        Body: {
          Html: { Data: buildEmailBody(notification), Charset: 'UTF-8' },
          Text: { Data: notification.body, Charset: 'UTF-8' },
        },
      },
    });

    await ses.send(command);

    await db.query(
      'UPDATE notifications SET status=$1, sent_at=NOW() WHERE id=$2',
      ['SENT', id]
    );
    console.log(`[NOTIF] Email sent: ${id} → ${email}`);

  } else if (channel === 'in_app') {
    // In-app notifications are already in DB — just mark as SENT for polling
    await db.query(
      'UPDATE notifications SET status=$1, sent_at=NOW() WHERE id=$2',
      ['SENT', id]
    );
    console.log(`[NOTIF] In-app notification ready: ${id}`);

  } else if (channel === 'sms') {
    // Twilio integration (optional at launch)
    // const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    // const user = await db.query('SELECT phone FROM users WHERE id=$1', [user_id]);
    // await twilio.messages.create({ body: notification.body, from: process.env.TWILIO_FROM, to: user.rows[0].phone });
    console.log(`[NOTIF] SMS (Twilio not configured): ${id}`);
    await db.query('UPDATE notifications SET status=$1, sent_at=NOW() WHERE id=$2', ['SENT', id]);
  }
}

// ─── POLL LOOP ────────────────────────────────────────────────────────────────

async function processMessage(message) {
  let notification;
  try {
    notification = JSON.parse(message.Body);
  } catch {
    console.error('[NOTIF] Invalid message body:', message.Body);
    return;
  }

  try {
    await dispatchNotification(notification);
  } catch (err) {
    console.error(`[NOTIF] Dispatch failed for ${notification.id}:`, err.message);

    const retries = (notification.retry_count || 0) + 1;
    if (retries >= 3) {
      await db.query(
        'UPDATE notifications SET status=$1, failed_at=NOW(), failure_reason=$2, retry_count=$3 WHERE id=$4',
        ['FAILED', err.message, retries, notification.id]
      );
    } else {
      await db.query(
        'UPDATE notifications SET retry_count=$1 WHERE id=$2',
        [retries, notification.id]
      );
      throw err; // Rethrow so message stays in queue for retry
    }
  }
}

async function poll() {
  if (!QUEUE_URL) {
    console.warn('[NOTIF] NOTIFICATION_QUEUE_URL not set. Falling back to DB polling.');
    // Fallback: directly poll DB for QUEUED notifications
    const result = await db.query(
      `SELECT * FROM notifications WHERE status='QUEUED' AND retry_count < 3
       ORDER BY created_at ASC LIMIT 10 FOR UPDATE SKIP LOCKED`
    );
    for (const row of result.rows) {
      await processMessage({ Body: JSON.stringify(row) }).catch(console.error);
    }
    return;
  }

  const command = new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: MAX_MESSAGES,
    WaitTimeSeconds: 10,          // Long polling
    VisibilityTimeout: 30,
  });

  const response = await sqs.send(command);
  const messages = response.Messages || [];

  for (const message of messages) {
    try {
      await processMessage(message);
      // Delete from queue on success
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }));
    } catch (err) {
      console.error('[NOTIF] Message processing failed, leaving in queue:', err.message);
    }
  }
}

async function run() {
  console.log('[NOTIF] Notification worker started.');
  while (true) {
    try {
      await poll();
    } catch (err) {
      console.error('[NOTIF] Poll error:', err.message);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[NOTIF] Shutting down...');
  await db.end();
  process.exit(0);
});

run().catch((err) => {
  console.error('[NOTIF] Fatal error:', err);
  process.exit(1);
});
