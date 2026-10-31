// "3 hours ago" labels. Pages are built once a day, so relative times are
// computed in the browser from each <time data-ago datetime="…">.

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
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
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

function refresh() {
  for (const el of document.querySelectorAll<HTMLTimeElement>('time[data-ago]')) {
    el.textContent = ago(el.dateTime);
    el.title = new Date(el.dateTime).toLocaleString();
  }
}

document.addEventListener('astro:page-load', refresh);
setInterval(refresh, 60_000);
