/** No sentiment filter and no automatic strikes. Every new item needs a human decision. */
export function moderationSignals(text: string): string[] {
  const value = text.normalize('NFKC').toLowerCase();
  const signals: string[] = [];
  if (/-----begin (?:rsa |ec |openssh )?private key-----/.test(value) ||
      /(?:password|пароль|passwort|mot de passe)\s*[:=]\s*\S{6,}/u.test(value)) signals.push('possible-credentials');
  if (/(?:i will|я тебя|ich werde dich|je vais te).{0,40}(?:kill|убью|töten|tuer)/u.test(value)) signals.push('possible-direct-threat');
  if (/(?:send|пришли|sende|envoyez).{0,50}(?:password|пароль|passwort|mot de passe|verification code)/u.test(value)) signals.push('possible-credential-scam');
  if ((value.match(/https?:\/\//g) || []).length > 4) signals.push('many-links');
  if (/(?:\+\d[\d ()-]{8,}|[\w.+-]+@[\w.-]+\.[a-z]{2,})/u.test(value)) signals.push('possible-personal-data');
  return signals.length ? signals : ['human-context-review'];
}

export function calendarMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export function restriction(confirmed: Date[], now = new Date()) {
  const dates = [...confirmed].sort((a, b) => +a - +b);
  if (dates.length >= 4) return {level: dates.length, blocked: true, until: null};
  const last = dates.at(-1);
  const until = last && dates.length >= 2 ? calendarMonths(last, dates.length === 2 ? 1 : 6) : null;
  return {level: dates.length, blocked: !!until && until > now, until};
}
export const contentModerationEnabled = () => process.env.CASHBACK_CONTENT_MODERATION === 'true';
export const CURRENT_FORUM_RULES_VERSION = '2026-10-22-reviews-v1';
