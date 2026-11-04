/** Builds .ics calendar files in the browser, so release dates can go straight into any calendar app. */
import type { Game } from '../shared/content';

function icsDate(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC 5545 asks for lines of at most 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** Only games with an exact day can become calendar events. */
export function hasExactDate(game: Game): boolean {
  return Boolean(game.releaseDate && !game.releaseLabel);
}

export function buildIcs(games: Game[], origin = window.location.origin): string {
  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cozy Dispatch//Release calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const g of games.filter(hasExactDate)) {
    const day = new Date(g.releaseDate!);
    const next = new Date(day.getTime() + 86400000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:release-${g.appId}@cozydispatch`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(day)}`,
      `DTEND;VALUE=DATE:${icsDate(next)}`,
      `SUMMARY:${escapeText(`${g.title} comes out on Steam`)}`,
      `DESCRIPTION:${escapeText(`Release date as Steam lists it today; dates can move.\n${origin}/game/${g.appId}/${g.slug}`)}`,
      `URL:${g.storeUrl}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(games: Game[], filename: string) {
  const blob = new Blob([buildIcs(games)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
