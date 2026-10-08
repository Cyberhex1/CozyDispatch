/** Typed browser client for the public newsletter endpoint. */
import type { NewsletterSubscribeResult } from '../shared/account';
import { apiRequest } from './accountApi';

export { ApiError } from './accountApi';

/**
 * Starts double opt-in. `check_inbox` means a confirmation email is on its way;
 * `mailer_offline` means the address was saved but no email was sent yet.
 * Neither means the person is subscribed.
 */
export function subscribeToNewsletter(email: string, source = 'footer'): Promise<NewsletterSubscribeResult> {
  return apiRequest('POST', '/api/newsletter/subscribe', { email, source });
}
