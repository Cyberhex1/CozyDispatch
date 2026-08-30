/**
 * src/services/emailService.ts
 *
 * Bridge module forwarding to the unified D1-backed emailDelivery service.
 */

import { getDb } from '../server/db/d1Client';
import {
  subscribeUser as d1SubscribeUser,
  broadcastNewsletter as d1BroadcastNewsletter,
  getOutbox as d1GetOutbox,
  getSubscribers as d1GetSubscribers,
  unsubscribeUserByToken as d1UnsubscribeUserByToken,
  sendEmail as d1SendEmail,
  renderWelcomeEmailHtml,
  renderNewsletterEmailHtml,
  SubscriberRecord,
  OutboxEmailRecord
} from '../server/newsletter/emailDelivery';

export type { SubscriberRecord, OutboxEmailRecord };
export { renderWelcomeEmailHtml, renderNewsletterEmailHtml };

export async function getSubscribers(): Promise<SubscriberRecord[]> {
  const db = await getDb();
  return d1GetSubscribers(db);
}

export async function getOutbox(): Promise<OutboxEmailRecord[]> {
  const db = await getDb();
  return d1GetOutbox(db);
}

export async function subscribeUser(
  email: string,
  source = 'footer_signup'
): Promise<{ success: boolean; isNew: boolean; alreadySubscribed?: boolean; welcomeSent: boolean; message: string; error?: string }> {
  const db = await getDb();
  return d1SubscribeUser(db, email, source);
}

export async function broadcastNewsletter(campaign: {
  headline: string;
  intro: string;
  editionNumber?: number;
  featuredGames?: any[];
  articles?: any[];
}) {
  const db = await getDb();
  return d1BroadcastNewsletter(db, campaign);
}

export async function unsubscribeUserByToken(token: string) {
  const db = await getDb();
  return d1UnsubscribeUserByToken(db, token);
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: 'welcome' | 'newsletter' | 'custom';
}) {
  const db = await getDb();
  return d1SendEmail(db, options);
}
