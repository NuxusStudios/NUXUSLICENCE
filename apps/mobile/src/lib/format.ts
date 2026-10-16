import type { Lang } from './i18n';

const locale = (lang: Lang) => (lang === 'fr' ? 'fr-CA' : 'en-CA');
const TZ = 'America/Toronto';

export function money(amount: number, lang: Lang = 'en'): string {
  return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'CAD' }).format(amount);
}

export function date(iso: string, lang: Lang = 'en'): string {
  // Date-only strings are calendar dates, not instants: don't shift them by timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(locale(lang), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(y!, m! - 1, d!)),
    );
  }
  return new Intl.DateTimeFormat(locale(lang), { year: 'numeric', month: 'short', day: 'numeric', timeZone: TZ }).format(new Date(iso));
}

export function dateTime(iso: string, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(locale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(iso));
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
}

/** Dates as printed on Canadian identity documents: YYYY/MM/DD. */
export function cardDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '/');
}

export function timeAgo(iso: string, lang: Lang = 'en'): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const fr = lang === 'fr';
  if (secs < 45) return fr ? "à l'instant" : 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return fr ? `il y a ${mins} min` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return fr ? `il y a ${hrs} h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return fr ? `il y a ${days} j` : `${days}d ago`;
}

export const METHOD = { card: 'Card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', interac: 'Interac' } as const;
