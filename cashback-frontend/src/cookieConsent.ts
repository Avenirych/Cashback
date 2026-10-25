export type CookieChoices = { analytics: boolean; marketing: boolean };
export type CookieDecision = CookieChoices & { version: 2; saved: boolean; necessary: true };
export const COOKIE_STORAGE_KEY = 'cashback_cookie_settings';
const CHANGE = 'cashback-cookie-consent-change';
export const OPEN_COOKIE_SETTINGS = 'cashback-open-cookie-settings';
const empty = (): CookieDecision => ({ version: 2, saved: false, necessary: true, analytics: false, marketing: false });
let volatileDecision: CookieDecision | null = null;

export function readCookieConsent(): CookieDecision {
  if (volatileDecision) return { ...volatileDecision };
  try {
    const value = JSON.parse(localStorage.getItem(COOKIE_STORAGE_KEY) || 'null');
    if (value?.version === 2 && value.saved === true && value.necessary === true &&
        typeof value.analytics === 'boolean' && typeof value.marketing === 'boolean') return value;
  } catch { /* Missing, corrupt or inaccessible storage is not consent. */ }
  return empty();
}

// Only recognizable optional first-party cookie names; never clear auth/storage wholesale.
function clearOptionalCookies(choices: CookieChoices) {
  const paths = new Set(['/']);
  const segments = window.location.pathname.split('/').filter(Boolean);
  while (segments.length) { paths.add('/' + segments.join('/')); segments.pop(); }
  const domains = [''];
  const host = window.location.hostname.split('.');
  for (let i = 0; i < host.length - 1; i++) domains.push(host.slice(i).join('.'));
  try {
    for (const entry of document.cookie.split(';')) {
      const name = entry.split('=')[0].trim();
      const analytics = /^(?:_ga(?:_|$)|_gid$|_gat(?:_|$)|_gac_)/.test(name);
      const marketing = /^(?:_fbp$|_fbc$|_gcl_au$|_gcl_)/.test(name);
      if ((!choices.analytics && analytics) || (!choices.marketing && marketing)) {
        for (const path of paths) for (const domain of domains) {
          document.cookie = `${name}=; Max-Age=0; path=${path}${domain ? '; domain=' + domain : ''}`;
        }
      }
    }
  } catch { /* HttpOnly, third-party and inaccessible cookies cannot be removed here. */ }
}

export function saveCookieConsent(choices: CookieChoices): boolean {
  const next: CookieDecision = { version: 2, saved: true, necessary: true, analytics: choices.analytics === true, marketing: choices.marketing === true };
  let stored = false;
  try {
    const json = JSON.stringify(next);
    localStorage.setItem(COOKIE_STORAGE_KEY, json);
    stored = localStorage.getItem(COOKIE_STORAGE_KEY) === json;
  } catch { /* Keep optional use disabled when persistence fails. */ }
  volatileDecision = stored ? null : empty();
  clearOptionalCookies(stored ? next : empty());
  window.dispatchEvent(new Event(CHANGE));
  return stored;
}

export function subscribeCookieConsent(listener: (decision: CookieDecision) => void): () => void {
  const changed = () => { const decision = readCookieConsent(); clearOptionalCookies(decision); listener(decision); };
  const storage = (event: StorageEvent) => {
    if (event.key === COOKIE_STORAGE_KEY || event.key === null) { volatileDecision = null; changed(); }
  };
  window.addEventListener(CHANGE, changed);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(CHANGE, changed); window.removeEventListener('storage', storage); };
}

export function openCookieSettings() { window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS)); }
