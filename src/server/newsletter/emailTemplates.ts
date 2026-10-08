/**
 * Email bodies and the small confirm/unsubscribe pages. Every interpolated
 * value goes through escapeHtml (HTML) or is plain text (text part).
 */
import { escapeHtml } from '../http';

const C = {
  paper: '#F6F1E7',
  card: '#FFFCF5',
  ink: '#2B2A26',
  muted: '#6B655A',
  rule: '#DDD3C1',
  accent: '#4E6A3D'
};
const SERIF = "Georgia, 'Fraunces', 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface IssueGame {
  appId: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
  storeUrl: string;
}

function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function emailShell(opts: { preheader: string; body: string; footer: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Cozy Dispatch</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.rule};">
<tr><td style="padding:28px 36px 18px;border-bottom:1px solid ${C.rule};font-family:${SERIF};font-size:22px;color:${C.ink};letter-spacing:0.2px;">Cozy Dispatch</td></tr>
${opts.body}
<tr><td style="padding:20px 36px 28px;border-top:1px solid ${C.rule};font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">${opts.footer}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${C.accent};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:15px;color:#FFFFFF;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

export function confirmationEmail(opts: { origin: string; confirmUrl: string; unsubscribeUrl: string }): RenderedEmail {
  const subject = 'Confirm your Cozy Dispatch subscription';
  const body = `<tr><td style="padding:28px 36px 8px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.ink};">One click and you’re on the list</td></tr>
<tr><td style="padding:8px 36px 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">
<p style="margin:0 0 16px;">Someone (hopefully you) asked to receive the Cozy Dispatch newsletter at this address. Please confirm so we know it’s really you.</p>
</td></tr>
<tr><td style="padding:4px 36px 24px;">${button(opts.confirmUrl, 'Confirm my subscription')}</td></tr>
<tr><td style="padding:0 36px 24px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">
This link works for 7 days. If you didn’t sign up, ignore this email and you won’t hear from us again.
</td></tr>`;
  const footer = `You received this because this address was entered at <a href="${escapeHtml(opts.origin)}/" style="color:${C.muted};">${escapeHtml(opts.origin.replace(/^https?:\/\//, ''))}</a>. <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${C.muted};">Don’t email me</a>.`;
  const text = [
    'Cozy Dispatch',
    '',
    'Someone (hopefully you) asked to receive the Cozy Dispatch newsletter at this address.',
    'Confirm your subscription (link valid for 7 days):',
    opts.confirmUrl,
    '',
    'If you didn’t sign up, ignore this email and you won’t hear from us again.',
    `Don’t email me: ${opts.unsubscribeUrl}`
  ].join('\n');
  return { subject, html: emailShell({ preheader: 'Confirm your subscription to Cozy Dispatch.', body, footer }), text };
}

export function issueEmail(opts: {
  origin: string;
  subject: string;
  intro: string;
  games: IssueGame[];
  unsubscribeUrl: string;
}): RenderedEmail {
  const intro = paragraphs(opts.intro);
  const introHtml = intro
    .map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const gamesHtml = opts.games
    .map((g) => {
      const img = g.imageUrl
        ? `<a href="${escapeHtml(g.storeUrl)}"><img src="${escapeHtml(g.imageUrl)}" width="528" alt="${escapeHtml(g.title)}" style="display:block;width:100%;max-width:528px;height:auto;border:1px solid ${C.rule};"></a>`
        : '';
      const price = g.price ? `<span style="color:${C.muted};"> · ${escapeHtml(g.price)}</span>` : '';
      const desc = g.description
        ? `<p style="margin:6px 0 0;font-family:${SANS};font-size:14px;line-height:1.55;color:${C.ink};">${escapeHtml(g.description)}</p>`
        : '';
      return `<tr><td style="padding:0 36px 26px;">${img}
<p style="margin:12px 0 0;font-family:${SERIF};font-size:19px;line-height:1.3;color:${C.ink};"><a href="${escapeHtml(g.storeUrl)}" style="color:${C.ink};text-decoration:none;">${escapeHtml(g.title)}</a><span style="font-family:${SANS};font-size:13px;">${price}</span></p>
${desc}
<p style="margin:8px 0 0;font-family:${SANS};font-size:13px;"><a href="${escapeHtml(g.storeUrl)}" style="color:${C.accent};">View on Steam →</a></p>
</td></tr>`;
    })
    .join('\n');

  const body = `<tr><td style="padding:28px 36px 8px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.ink};">${escapeHtml(opts.subject)}</td></tr>
<tr><td style="padding:8px 36px 8px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">${introHtml}</td></tr>
${gamesHtml ? `<tr><td style="padding:4px 36px 14px;font-family:${SANS};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};">This week’s picks</td></tr>\n${gamesHtml}` : ''}
<tr><td style="padding:0 36px 26px;font-family:${SANS};font-size:15px;"><a href="${escapeHtml(opts.origin)}/" style="color:${C.accent};">Browse more on Cozy Dispatch →</a></td></tr>`;

  const footer = `You’re getting this because you subscribed to Cozy Dispatch. Prices are from the US Steam store when this was sent and may have changed. <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${C.muted};">Unsubscribe</a>.`;

  const textGames = opts.games.map((g) =>
    [`* ${g.title}${g.price ? ` (${g.price})` : ''}`, g.description ? `  ${g.description}` : '', `  ${g.storeUrl}`].filter(Boolean).join('\n')
  );
  const text = [
    'Cozy Dispatch',
    '',
    opts.subject,
    '',
    intro.join('\n\n'),
    ...(textGames.length ? ['', 'THIS WEEK’S PICKS', '', textGames.join('\n\n')] : []),
    '',
    `Browse more: ${opts.origin}/`,
    '',
    `Unsubscribe: ${opts.unsubscribeUrl}`
  ].join('\n');

  return {
    subject: opts.subject,
    html: emailShell({ preheader: intro[0]?.slice(0, 140) ?? opts.subject, body, footer }),
    text
  };
}

/**
 * Self-contained page for confirm/unsubscribe results.
 * `bodyHtml` must already be safe (built with escapeHtml by the caller).
 */
export function simplePage(opts: { title: string; heading: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(opts.title)} · Cozy Dispatch</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:${C.paper};color:${C.ink};font:16px/1.6 ${SANS}}
  main{width:100%;max-width:460px;background:${C.card};border:1px solid ${C.rule};padding:32px 28px}
  .mark{font-family:${SERIF};font-size:15px;color:${C.muted};margin:0 0 22px;padding-bottom:14px;border-bottom:1px solid ${C.rule}}
  .mark a{color:inherit;text-decoration:none}
  h1{font-family:${SERIF};font-weight:normal;font-size:28px;line-height:1.2;margin:0 0 14px}
  p{margin:0 0 14px}
  .muted{color:${C.muted};font-size:14px}
  a{color:${C.accent}}
  button{font:inherit;font-size:15px;background:${C.accent};color:#fff;border:0;padding:12px 22px;cursor:pointer;min-height:44px}
  button:hover{filter:brightness(1.08)}
  button:focus-visible,a:focus-visible{outline:2px solid ${C.ink};outline-offset:3px}
  form{margin:18px 0}
</style></head>
<body><main>
<p class="mark"><a href="/">Cozy Dispatch</a></p>
<h1>${escapeHtml(opts.heading)}</h1>
${opts.bodyHtml}
<p class="muted"><a href="/">← Back to Cozy Dispatch</a></p>
</main></body></html>`;
}
