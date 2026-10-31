// "3 hours ago" labels. Pages are built once a day, so relative times are
// computed in the browser from each <time data-ago datetime="…">.

import { pageLang, tc } from '../i18n';

const formatters = new Map<string, Intl.RelativeTimeFormat>();
const rtf = () => {
  const lang = pageLang();
  if (!formatters.has(lang)) formatters.set(lang, new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }));
  return formatters.get(lang)!;
};
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function ago(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf().format(Math.round(seconds / size), unit);
  }
  return tc('justNow');
}

function refresh() {
  for (const el of document.querySelectorAll<HTMLTimeElement>('time[data-ago]')) {
    el.textContent = ago(el.dateTime);
    el.title = new Date(el.dateTime).toLocaleString(pageLang());
  }
}

document.addEventListener('astro:page-load', refresh);
setInterval(refresh, 60_000);
