/**
 * Account + newsletter types, limits and validators shared by the browser
 * and the API (Workers-safe: no Node or DOM-only APIs).
 */

export const AVATARS = ['sprout', 'mushroom', 'teapot', 'cat', 'frog', 'moon', 'leaf', 'lantern'] as const;
export type Avatar = typeof AVATARS[number];
export const DEFAULT_AVATAR: Avatar = 'sprout';

export interface AccountUser {
  id: string;
  email: string;
  displayName: string;
  avatar: Avatar;
  bio: string;
  /** ISO timestamp */
  memberSince: string;
}

export interface AccountState {
  user: AccountUser;
  /** Steam app ids, newest first */
  wishlist: number[];
  /** Article ids, newest first */
  bookmarks: string[];
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
export const EMAIL_MAX = 254;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 280;
export const ARTICLE_ID_MAX = 200;
/** Maximum items in a wishlist and in bookmarks. */
export const SAVED_ITEMS_CAP = 1000;

export type NewsletterSubscribeStatus = 'check_inbox' | 'mailer_offline';
export interface NewsletterSubscribeResult {
  status: NewsletterSubscribeStatus;
  message: string;
}

// ---------------------------------------------------------------------------
// Validators (return an error message, or null when valid)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:".]+(\.[^\s@<>()[\]\\,;:".]+)*\.[a-z]{2,}$/i;
// C0/C1 control characters plus zero-width and bidi-override characters.
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/;
const CONTROL_EXCEPT_NEWLINE_RE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/;

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (value.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  return null;
}

export function validateDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return 'Please choose a display name.';
  const name = value.trim();
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    return `Display name must be ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} characters.`;
  }
  if (CONTROL_RE.test(name)) return 'Display name contains characters we can’t display.';
  return null;
}

export function validateBio(value: unknown): string | null {
  if (typeof value !== 'string') return 'Bio must be text.';
  if (value.trim().length > BIO_MAX) return `Bio must be at most ${BIO_MAX} characters.`;
  if (CONTROL_EXCEPT_NEWLINE_RE.test(value.replace(/\r\n/g, '\n'))) return 'Bio contains characters we can’t display.';
  return null;
}

export function isAvatar(value: unknown): value is Avatar {
  return typeof value === 'string' && (AVATARS as readonly string[]).includes(value);
}

export function isValidAppId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function isValidArticleId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= ARTICLE_ID_MAX && !CONTROL_RE.test(value);
}
