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
