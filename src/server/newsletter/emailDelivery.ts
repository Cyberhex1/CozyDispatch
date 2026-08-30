/**
 * src/server/newsletter/emailDelivery.ts
 *
 * Edge-compatible newsletter management & transactional email delivery.
 * Integrates directly with Resend (and SendGrid) via standard fetch API.
 * Accurately persists subscriber records, prevents duplicates, and audits email delivery in D1.
 */

import { ID1Database } from '../db/d1Client';
import { generateToken } from '../auth/cryptoUtils';

export interface SubscriberRecord {
  id: string;
  email: string;
  subscribedAt: string;
  source: string;
  status: 'active' | 'unsubscribed';
  welcomeEmailSent: boolean;
  welcomeEmailSentAt?: string;
  unsubscribeToken: string;
  lastNewsletterSentAt?: string;
}

export interface OutboxEmailRecord {
  id: string;
  recipient: string;
  subject: string;
  template: 'welcome' | 'newsletter' | 'custom';
  provider: string;
  status: 'delivered' | 'failed';
  sentAt: string;
  htmlContent: string;
  textContent: string;
  error?: string;
}

export interface EnvBindings {
  DB?: ID1Database;
  RESEND_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
  GEMINI_API_KEY?: string;
}

// ============================================================================
// Core Email Dispatcher
// ============================================================================

export async function sendEmail(
  db: ID1Database,
  options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    template: 'welcome' | 'newsletter' | 'custom';
  },
  env?: EnvBindings
): Promise<{ success: boolean; provider: string; messageId?: string; error?: string }> {
  const resendKey = env?.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env.RESEND_API_KEY : undefined);
  const sendgridKey = env?.SENDGRID_API_KEY || (typeof process !== 'undefined' ? process.env.SENDGRID_API_KEY : undefined);
  const fromEmail = env?.EMAIL_FROM || (typeof process !== 'undefined' ? process.env.EMAIL_FROM : undefined) || 'Cozy Dispatch <newsletter@cozydispatch.com>';
  
  const internalId = `msg_${generateToken(16)}`;
  const now = new Date().toISOString();

  // 1. Resend Delivery Provider
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text
        })
      });

      const responseData: any = await res.json().catch(() => ({}));

      if (res.ok && responseData.id) {
        const remoteId = responseData.id;
        await db
          .prepare(`
            INSERT INTO email_outbox (id, recipient, subject, template, provider, status, sent_at, html_content, text_content)
            VALUES (?, ?, ?, ?, ?, 'delivered', ?, ?, ?)
          `)
          .bind(remoteId, options.to, options.subject, options.template, 'resend', now, options.html, options.text)
          .run();

        return { success: true, provider: 'resend', messageId: remoteId };
      } else {
        const errorMsg = responseData.message || responseData.error || `Resend API returned status ${res.status}`;
        await db
          .prepare(`
            INSERT INTO email_outbox (id, recipient, subject, template, provider, status, sent_at, html_content, text_content, error)
            VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?)
          `)
          .bind(internalId, options.to, options.subject, options.template, 'resend', now, options.html, options.text, errorMsg)
          .run();

        return { success: false, provider: 'resend', error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Resend network connection failed';
      await db
        .prepare(`
          INSERT INTO email_outbox (id, recipient, subject, template, provider, status, sent_at, html_content, text_content, error)
          VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?)
        `)
        .bind(internalId, options.to, options.subject, options.template, 'resend', now, options.html, options.text, errorMsg)
        .run();

      return { success: false, provider: 'resend', error: errorMsg };
    }
  }

  // 2. SendGrid Delivery Provider
  if (sendgridKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: fromEmail.replace(/.*<(.+)>/, '$1') || 'newsletter@cozydispatch.com', name: 'Cozy Dispatch' },
          subject: options.subject,
          content: [
            { type: 'text/plain', value: options.text },
            { type: 'text/html', value: options.html }
          ]
        })
      });

      if (res.ok) {
        await db
          .prepare(`
            INSERT INTO email_outbox (id, recipient, subject, template, provider, status, sent_at, html_content, text_content)
            VALUES (?, ?, ?, ?, ?, 'delivered', ?, ?, ?)
          `)
          .bind(internalId, options.to, options.subject, options.template, 'sendgrid', now, options.html, options.text)
          .run();

        return { success: true, provider: 'sendgrid', messageId: internalId };
      } else {
        const errorText = await res.text().catch(() => '');
        const errorMsg = `SendGrid error status ${res.status}: ${errorText}`;
        await db
          .prepare(`
            INSERT INTO email_outbox (id, recipient, subject, template, provider, status, sent_at, html_content, text_content, error)
            VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?)
          `)
          .bind(internalId, options.to, options.subject, options.template, 'sendgrid', now, options.html, options.text, errorMsg)
          .run();

        return { success: false, provider: 'sendgrid', error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'SendGrid network error';
      await db
        .prepare(`
          INSERT INTO email_outbox (id, recipient, subject, template, provider, status, sent_at, html_content, text_content, error)
          VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?)
        `)
        .bind(internalId, options.to, options.subject, options.template, 'sendgrid', now, options.html, options.text, errorMsg)
        .run();

      return { success: false, provider: 'sendgrid', error: errorMsg };
    }
  }

  // 3. No Email Provider Configured
  // NEVER report false success. Accurately audit as unconfigured and return clear instructions.
  const unconfiguredError = 'No transactional email provider configured. Please set RESEND_API_KEY in environment variables to send emails.';
  
  await db
    .prepare(`
      INSERT INTO email_outbox (id, recipient, subject, template, provider, status, sent_at, html_content, text_content, error)
      VALUES (?, ?, ?, ?, 'none', 'failed', ?, ?, ?, ?)
    `)
    .bind(internalId, options.to, options.subject, options.template, now, options.html, options.text, unconfiguredError)
    .run();

  return {
    success: false,
    provider: 'none',
    error: unconfiguredError
  };
}

// ============================================================================
// Email Template Renderers
// ============================================================================

export function renderWelcomeEmailHtml(email: string, unsubscribeToken: string, appUrl = 'https://cozydispatch.pages.dev'): string {
  const unsubUrl = `${appUrl}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Cozy Dispatch</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F0; color: #2C2C24; margin: 0; padding: 24px 12px; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; border: 1px solid #E6E2D8; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
    .header { text-align: center; border-bottom: 2px solid #F0ECE1; padding-bottom: 24px; margin-bottom: 24px; }
    .badge { display: inline-block; background-color: #4A6B47; color: #FFFFFF; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 999px; }
    h1 { font-family: 'Georgia', serif; font-size: 24px; color: #2C2C24; margin: 16px 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #505045; margin: 12px 0; }
    .highlight-box { background-color: #F4F8F3; border: 1px solid #D1E2CF; border-radius: 14px; padding: 18px; margin: 20px 0; }
    .highlight-box h3 { margin-top: 0; font-size: 15px; color: #4A6B47; }
    .btn { display: inline-block; background-color: #2C2C24; color: #FFFFFF; font-size: 13px; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 12px; margin-top: 16px; }
    .footer { text-align: center; font-size: 11px; color: #8A8A7C; margin-top: 32px; border-top: 1px solid #F0ECE1; padding-top: 20px; }
    .footer a { color: #4A6B47; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">🌸 Cozy Dispatch</span>
      <h1>Welcome to the Quiet Corner of Gaming</h1>
      <p>Your subscription is confirmed for <strong>${email}</strong>.</p>
    </div>

    <p>Hello and welcome!</p>
    <p>You are now subscribed to the <strong>Weekly Cozy Dispatch</strong>. Every Friday morning, we deliver a lovingly curated roundup of everything that makes indie and relaxing games special.</p>

    <div class="highlight-box">
      <h3>What to Expect Every Friday:</h3>
      <ul style="padding-left: 20px; font-size: 13px; color: #4A5B47; line-height: 1.7; margin: 0;">
        <li><strong>Steam Sale Radar</strong> — Top discounts on wholesome farming sims, gridless builders, and atmospheric adventures.</li>
        <li><strong>Steam Deck Verified Picks</strong> — Low-battery-drain, high-vibe games tested for cozy handheld play.</li>
        <li><strong>Developer Patch Recaps</strong> — 30-second bulleted takeaways on new crops, romance quests, and roadmaps.</li>
        <li><strong>Community Hidden Gems</strong> — Handpicked micro-indies you won't find on algorithmic frontpages.</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${appUrl}" class="btn">Explore the Cozy Catalog →</a>
    </div>

    <p style="font-size: 12px; color: #8A8A7C;">
      Have a favorite cozy game or indie announcement we should feature? Reply directly to this email anytime.
    </p>

    <div class="footer">
      <p>Sent with care by Cozy Dispatch • Independent Editorial & Indie Games</p>
      <p>
        <a href="${unsubUrl}">Unsubscribe</a> anytime with one click.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function renderNewsletterEmailHtml(
  subscriber: SubscriberRecord,
  campaign: {
    headline: string;
    intro: string;
    editionNumber?: number;
    featuredGames?: Array<{ id: string; title: string; price?: string; category?: string; coverImage?: string; shortDescription?: string }>;
    articles?: Array<{ id: string; title: string; summary?: string; sourceOutlet?: string; sourceUrl?: string }>;
  },
  appUrl = 'https://cozydispatch.pages.dev'
): string {
  const unsubUrl = `${appUrl}/api/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`;

  const gamesHtml = (campaign.featuredGames || [])
    .map(
      (g) => `
      <div style="background: #FAF8F5; border: 1px solid #EAE6DB; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
        <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #2C2C24;">${g.title} <span style="font-size: 12px; color: #4A6B47; font-weight: normal;">(${g.price || 'On Sale'})</span></h4>
        <p style="margin: 0; font-size: 12px; color: #505045; line-height: 1.5;">${g.shortDescription || ''}</p>
      </div>`
    )
    .join('');

  const articlesHtml = (campaign.articles || [])
    .map(
      (a) => `
      <div style="margin-bottom: 12px;">
        <a href="${a.sourceUrl || appUrl}" style="font-size: 13px; font-weight: bold; color: #2C2C24; text-decoration: none;">✦ ${a.title}</a>
        <p style="margin: 2px 0 0 0; font-size: 12px; color: #6A6A5C;">${a.summary || ''} <em style="color: #4A6B47;">— ${a.sourceOutlet || 'Indie News'}</em></p>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${campaign.headline}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #F8F6F0; color: #2C2C24; margin: 0; padding: 24px 12px;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; border: 1px solid #E6E2D8; padding: 32px;">
    <div style="text-align: center; border-bottom: 2px solid #F0ECE1; padding-bottom: 20px; margin-bottom: 20px;">
      <span style="background: #4A6B47; color: #fff; font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 999px; text-transform: uppercase;">Cozy Dispatch ${campaign.editionNumber ? `Edition #${campaign.editionNumber}` : 'Weekly'}</span>
      <h1 style="font-family: Georgia, serif; font-size: 22px; margin: 12px 0 6px 0;">${campaign.headline}</h1>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #404035;">${campaign.intro}</p>
    
    ${campaign.featuredGames && campaign.featuredGames.length > 0 ? `<h3 style="font-size: 15px; color: #4A6B47; margin: 24px 0 12px 0;">🎮 Weekly Featured Cozy Games</h3>${gamesHtml}` : ''}
    ${campaign.articles && campaign.articles.length > 0 ? `<h3 style="font-size: 15px; color: #4A6B47; margin: 24px 0 12px 0;">📰 Top Indie Dispatches & Updates</h3>${articlesHtml}` : ''}

    <div style="text-align: center; margin: 28px 0;">
      <a href="${appUrl}" style="background: #2C2C24; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: bold; display: inline-block;">Browse Full Cozy Dispatch →</a>
    </div>

    <div style="text-align: center; font-size: 11px; color: #8A8A7C; margin-top: 32px; border-top: 1px solid #F0ECE1; padding-top: 16px;">
      <p>You received this because you are subscribed to Cozy Dispatch.</p>
      <p><a href="${unsubUrl}" style="color: #4A6B47;">Unsubscribe</a> anytime with 1-click.</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// Subscriber Database Operations
// ============================================================================

export async function getSubscribers(db: ID1Database): Promise<SubscriberRecord[]> {
  const rows = await db
    .prepare('SELECT id, email, subscribed_at, source, status, welcome_email_sent, welcome_email_sent_at, unsubscribe_token, last_newsletter_sent_at FROM newsletter_subscribers ORDER BY subscribed_at DESC')
    .all<any>();

  return rows.results.map((r: any) => ({
    id: r.id,
    email: r.email,
    subscribedAt: r.subscribed_at,
    source: r.source,
    status: r.status,
    welcomeEmailSent: Boolean(r.welcome_email_sent),
    welcomeEmailSentAt: r.welcome_email_sent_at,
    unsubscribeToken: r.unsubscribe_token,
    lastNewsletterSentAt: r.last_newsletter_sent_at
  }));
}

export async function getOutbox(db: ID1Database): Promise<OutboxEmailRecord[]> {
  const rows = await db
    .prepare('SELECT id, recipient, subject, template, provider, status, sent_at, html_content, text_content, error FROM email_outbox ORDER BY sent_at DESC LIMIT 200')
    .all<any>();

  return rows.results.map((r: any) => ({
    id: r.id,
    recipient: r.recipient,
    subject: r.subject,
    template: r.template,
    provider: r.provider,
    status: r.status,
    sentAt: r.sent_at,
    htmlContent: r.html_content || '',
    textContent: r.text_content || '',
    error: r.error
  }));
}

/**
 * Subscribes a user, enforces deduplication in D1, and triggers real transactional welcome email.
 */
export async function subscribeUser(
  db: ID1Database,
  email: string,
  source = 'footer_signup',
  env?: EnvBindings
): Promise<{
  success: boolean;
  isNew: boolean;
  alreadySubscribed?: boolean;
  welcomeSent: boolean;
  message: string;
  error?: string;
}> {
  if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
    return { success: false, isNew: false, welcomeSent: false, message: 'Invalid email address.', error: 'Invalid email address.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db
    .prepare('SELECT id, email, status, unsubscribe_token, welcome_email_sent FROM newsletter_subscribers WHERE email = ? COLLATE NOCASE')
    .bind(normalizedEmail)
    .first<any>();

  if (existing) {
    if (existing.status === 'active') {
      return {
        success: true,
        isNew: false,
        alreadySubscribed: true,
        welcomeSent: false,
        message: 'You are already subscribed to the Cozy Dispatch!'
      };
    }

    // Re-activate previously unsubscribed user
    const now = new Date().toISOString();
    await db
      .prepare("UPDATE newsletter_subscribers SET status = 'active', subscribed_at = ? WHERE id = ?")
      .bind(now, existing.id)
      .run();

    return {
      success: true,
      isNew: false,
      alreadySubscribed: false,
      welcomeSent: false,
      message: 'Welcome back! Your Cozy Dispatch subscription has been re-activated.'
    };
  }

  // Create new subscriber
  const subId = `sub_${generateToken(16)}`;
  const unsubToken = generateToken(16);
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO newsletter_subscribers 
      (id, email, subscribed_at, source, status, welcome_email_sent, unsubscribe_token)
      VALUES (?, ?, ?, ?, 'active', 0, ?)
    `)
    .bind(subId, normalizedEmail, now, source, unsubToken)
    .run();

  // Send Welcome Email
  const appUrl = env?.APP_URL || (typeof process !== 'undefined' ? process.env.APP_URL : undefined) || 'https://cozydispatch.pages.dev';
  const htmlContent = renderWelcomeEmailHtml(normalizedEmail, unsubToken, appUrl);
  const textContent = `Welcome to Cozy Dispatch!\nYour subscription for ${normalizedEmail} is confirmed.\n\nUnsubscribe: ${appUrl}/api/newsletter/unsubscribe?token=${unsubToken}`;

  const emailResult = await sendEmail(
    db,
    {
      to: normalizedEmail,
      subject: '🌸 Welcome to Cozy Dispatch — The Quiet Corner of Gaming',
      html: htmlContent,
      text: textContent,
      template: 'welcome'
    },
    env
  );

  if (emailResult.success) {
    await db
      .prepare('UPDATE newsletter_subscribers SET welcome_email_sent = 1, welcome_email_sent_at = ? WHERE id = ?')
      .bind(now, subId)
      .run();
  }

  return {
    success: true,
    isNew: true,
    alreadySubscribed: false,
    welcomeSent: emailResult.success,
    message: emailResult.success
      ? 'Subscribed! We have sent a welcome note to your inbox.'
      : 'Subscribed to the Cozy Dispatch weekly recap!'
  };
}

/**
 * Broadcasts a newsletter campaign to all active subscribers.
 */
export async function broadcastNewsletter(
  db: ID1Database,
  campaign: {
    headline: string;
    intro: string;
    editionNumber?: number;
    featuredGames?: any[];
    articles?: any[];
  },
  env?: EnvBindings
): Promise<{
  totalSubscribers: number;
  attemptedSends: number;
  successfulSends: number;
  failedSends: number;
}> {
  const activeSubs = await db
    .prepare("SELECT id, email, unsubscribe_token FROM newsletter_subscribers WHERE status = 'active'")
    .all<any>();

  const appUrl = env?.APP_URL || (typeof process !== 'undefined' ? process.env.APP_URL : undefined) || 'https://cozydispatch.pages.dev';
  const now = new Date().toISOString();
  let successfulSends = 0;
  let failedSends = 0;

  for (const sub of activeSubs.results) {
    const htmlContent = renderNewsletterEmailHtml(
      {
        id: sub.id,
        email: sub.email,
        subscribedAt: '',
        source: '',
        status: 'active',
        welcomeEmailSent: true,
        unsubscribeToken: sub.unsubscribe_token
      },
      campaign,
      appUrl
    );

    const textContent = `${campaign.headline}\n\n${campaign.intro}\n\nUnsubscribe: ${appUrl}/api/newsletter/unsubscribe?token=${sub.unsubscribe_token}`;

    const res = await sendEmail(
      db,
      {
        to: sub.email,
        subject: `🌸 Cozy Dispatch: ${campaign.headline}`,
        html: htmlContent,
        text: textContent,
        template: 'newsletter'
      },
      env
    );

    if (res.success) {
      successfulSends++;
      await db
        .prepare('UPDATE newsletter_subscribers SET last_newsletter_sent_at = ? WHERE id = ?')
        .bind(now, sub.id)
        .run();
    } else {
      failedSends++;
    }
  }

  return {
    totalSubscribers: activeSubs.results.length,
    attemptedSends: activeSubs.results.length,
    successfulSends,
    failedSends
  };
}

/**
 * Handles 1-click unsubscriptions.
 */
export async function unsubscribeUserByToken(
  db: ID1Database,
  token: string
): Promise<{ success: boolean; message: string; email?: string }> {
  if (!token) {
    return { success: false, message: 'Invalid or missing unsubscribe token.' };
  }

  const sub = await db
    .prepare('SELECT id, email, status FROM newsletter_subscribers WHERE unsubscribe_token = ?')
    .bind(token)
    .first<any>();

  if (!sub) {
    return { success: false, message: 'Subscriber record not found.' };
  }

  if (sub.status === 'unsubscribed') {
    return { success: true, message: 'You are already unsubscribed.', email: sub.email };
  }

  await db
    .prepare("UPDATE newsletter_subscribers SET status = 'unsubscribed' WHERE id = ?")
    .bind(sub.id)
    .run();

  return {
    success: true,
    message: `You have successfully unsubscribed ${sub.email} from Cozy Dispatch emails.`,
    email: sub.email
  };
}
