// Console-style controls: arrow keys and a gamepad move between `[data-nav]`
// items, ✕/Enter opens, ○/Escape goes back, △ opens the repo, □ toggles
// sound, L1/R1 flip between projects.
// Selecting an item tints the backdrop with its `data-hue`.

import { navigate } from 'astro:transitions/client';
import { setScene } from './scene-events';
import { play, setSound, soundOn } from './sound';

type Dir = 'up' | 'down' | 'left' | 'right';

const items = () => [...document.querySelectorAll<HTMLElement>('[data-nav]')].filter((el) => el.offsetParent !== null);
const current = () => {
  const a = document.activeElement as HTMLElement | null;
  return a?.matches('[data-nav]') ? a : null;
};

function select(el: HTMLElement, { sound = true, scroll = true } = {}) {
  if (sound && el !== current()) play('move');
  el.focus({ preventScroll: true });
  if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function onSelected(el: HTMLElement) {
  if (el.dataset.hue) setScene({ hue: Number(el.dataset.hue) });
  document.dispatchEvent(new CustomEvent('rw:selected', { detail: el }));
  if (el.dataset.slug) {
    try {
      sessionStorage.setItem('rw-last', el.dataset.slug);
    } catch {}
  }
}

/** Nearest item in a direction, favouring ones roughly in line. */
function neighbour(from: HTMLElement, dir: Dir): HTMLElement | undefined {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | undefined;
  let bestScore = Infinity;
  for (const el of items()) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (main <= 4) continue;
    const score = main + cross * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function move(dir: Dir): boolean {
  const from = current();
  if (!from) {
    const first = items()[0];
    if (!first) return false;
    select(first);
    return true;
  }
  const next = neighbour(from, dir);
  if (!next) return false;
  select(next);
  return true;
}

// Browsers do not count controller presses as a user gesture, so a new tab
// opened from one gets blocked; the controller opens outside links in place.
let fromPad = false;

function open(el: HTMLAnchorElement) {
  const href = el.getAttribute('href') ?? '';
  if (href.startsWith('#')) document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  else if (el.target !== '_blank') navigate(el.href);
  else if (fromPad) location.href = el.href;
  else window.open(el.href, '_blank', 'noopener');
}

function clickLink(selector: string) {
  const el = document.querySelector<HTMLAnchorElement>(selector);
  if (!el) return false;
  play(selector === '[data-back]' ? 'back' : 'confirm');
  open(el);
  return true;
}

function confirm() {
  const el = current();
  if (!el) return;
  play('confirm');
  if (el instanceof HTMLAnchorElement) open(el);
  else el.click();
}

function toggleSound() {
  setSound(!soundOn());
  syncSoundButton();
}

const KEYS: Record<string, () => boolean | void> = {
  ArrowUp: () => move('up'),
  ArrowDown: () => move('down'),
  ArrowLeft: () => move('left'),
  ArrowRight: () => move('right'),
  Escape: () => clickLink('[data-back]'),
  Backspace: () => clickLink('[data-back]'),
  PageUp: () => clickLink('[data-prev]'),
  PageDown: () => clickLink('[data-next]'),
};

addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target as HTMLElement;
  if (t.matches('input, textarea, select, [contenteditable]')) return;
  fromPad = false;
  // Up/down scroll the page normally unless an item is selected.
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !current()) return;
  if (e.key === 'Enter' && current()) {
    play('confirm');
    return;
  }
  const handler = KEYS[e.key];
  if (handler && handler() !== false) e.preventDefault();
});

// Gamepad, standard mapping: 0 ✕, 1 ○, 2 □, 3 △, 4 L1, 5 R1, 12-15 d-pad,
// left stick moves like the d-pad, right stick scrolls the page.
const held = new Map<number, number>();
let polling = false;

/** D-pad up/down past the last item scrolls instead, so long pages are readable. */
const padMove = (dir: Dir) => move(dir) || ((dir === 'up' || dir === 'down') && scrollBy({ top: dir === 'up' ? -240 : 240, behavior: 'smooth' }));

function pollPads(now: number) {
  const pad = [...navigator.getGamepads()].find(Boolean);
  if (!pad) {
    polling = false;
    return;
  }
  const pressed = (i: number) => !!pad.buttons[i]?.pressed;
  const [lx = 0, ly = 0, , ry = 0] = pad.axes;
  const inputs: [number, boolean, () => unknown][] = [
    [12, pressed(12) || ly < -0.6, () => padMove('up')],
    [13, pressed(13) || ly > 0.6, () => padMove('down')],
    [14, pressed(14) || lx < -0.6, () => padMove('left')],
    [15, pressed(15) || lx > 0.6, () => padMove('right')],
    [0, pressed(0), confirm],
    [1, pressed(1), () => clickLink('[data-back]')],
    [2, pressed(2), toggleSound],
    [3, pressed(3), () => clickLink('[data-repo]')],
    [4, pressed(4), () => clickLink('[data-prev]')],
    [5, pressed(5), () => clickLink('[data-next]')],
  ];
  for (const [id, down, act] of inputs) {
    const since = held.get(id);
    if (!down) held.delete(id);
    else if (since === undefined) {
      held.set(id, now + 380);
      fromPad = true;
      // The boot screen (and anything else waiting for "press any button") listens for this.
      if (!dispatchEvent(new CustomEvent('rw:pad-press', { cancelable: true }))) continue;
      act();
    } else if (id >= 12 && now > since) {
      held.set(id, now + 140);
      act();
    }
  }
  if (Math.abs(ry) > 0.2) scrollBy({ top: ry * 22 });
  requestAnimationFrame(pollPads);
}

function startPolling() {
  if (polling) return;
  polling = true;
  requestAnimationFrame(pollPads);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(text: string) {
  const el = document.querySelector<HTMLElement>('[data-toast]');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

addEventListener('gamepadconnected', () => {
  toast('Controller connected');
  startPolling();
});
addEventListener('gamepaddisconnected', () => toast('Controller disconnected'));
if ([...navigator.getGamepads()].some(Boolean)) startPolling();

// Selection follows focus and hover.
document.addEventListener('focusin', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
  if (el) onSelected(el);
});
document.addEventListener('pointerover', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
  if (el && el !== current() && matchMedia('(hover: hover)').matches) select(el, { scroll: false });
});

// Sound toggle and clock live in the persistent chrome.
function syncSoundButton() {
  const btn = document.querySelector<HTMLButtonElement>('[data-sound]');
  if (btn) btn.setAttribute('aria-pressed', String(soundOn()));
}
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-sound]')) toggleSound();
});

function tickClock() {
  const el = document.querySelector('[data-clock]');
  if (el) {
    const d = new Date();
    el.textContent = d.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
setInterval(tickClock, 15_000);

document.addEventListener('astro:page-load', () => {
  syncSoundButton();
  tickClock();
  const mode = (document.body.dataset.scene as 'menu' | 'page' | undefined) ?? 'page';
  setScene({ mode });
  // Re-select what was selected last time on this page (the PS2 remembers your
  // place in the browser), or the page's preferred first item.
  let last: string | null = null;
  try {
    // Visiting a project page makes it the one to return to.
    const visiting = document.querySelector<HTMLElement>('[data-current]')?.dataset.current;
    if (visiting) sessionStorage.setItem('rw-last', visiting);
    last = sessionStorage.getItem('rw-last');
  } catch {}
  const start =
    (mode === 'menu' && last && document.querySelector<HTMLElement>(`[data-nav][data-slug="${last}"]`)) ||
    document.querySelector<HTMLElement>('[data-nav][data-autofocus]');
  if (start) select(start, { sound: false, scroll: false });
  else {
    const hue = document.body.dataset.hue;
    setScene({ mode, hue: hue ? Number(hue) : undefined });
  }
});
