// The visitor's System Configuration, kept in localStorage. Applying it sets
// `data-motion` and `data-background` on <html>, which the CSS and the 3D
// backdrop follow. Base.astro repeats the apply step inline in <head> so the
// first paint already matches.

import type { Lang } from '../i18n';

export interface Settings {
  lang?: Lang;
  sound: boolean;
  intro: 'session' | 'always' | 'never';
  motion: 'system' | 'full' | 'reduced';
  background: 'towers' | 'still' | 'off';
  clock: '24' | '12';
}

const KEY = 'rw-settings';
const DEFAULTS: Settings = { sound: false, intro: 'session', motion: 'system', background: 'towers', clock: '24' };

export function getSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    // Before settings existed, sound had its own key.
    if (saved.sound === undefined && localStorage.getItem('rw-sound') === '1') saved.sound = true;
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSettings(change: Partial<Settings>) {
  const next = { ...getSettings(), ...change };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  applySettings();
  dispatchEvent(new CustomEvent<Settings>('rw:settings', { detail: next }));
  return next;
}

export function reducedMotion(s = getSettings()) {
  return s.motion === 'reduced' || (s.motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export function applySettings() {
  const s = getSettings();
  const root = document.documentElement;
  root.dataset.motion = reducedMotion(s) ? 'reduced' : 'full';
  root.dataset.background = s.background;
}

applySettings();
// <html> attributes are replaced on every client-side navigation.
document.addEventListener('astro:after-swap', applySettings);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applySettings);
