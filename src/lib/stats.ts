// How far along a project is, in numbers the Progress page and the Browser
// both sort by.

import type { Checklist, Project, Tone } from './github';

export const count = (l: Checklist | undefined, step: 'done' | 'wip' | 'todo') =>
  l?.items.filter((i) => i.step === step).length ?? 0;

/** 0..1, an item in progress counting half; -1 when the README has no such checklist. */
export function ratio(l: Checklist | undefined) {
  if (!l?.items.length) return -1;
  return (count(l, 'done') + count(l, 'wip') / 2) / l.items.length;
}

const TONE_RANK: Record<Tone, number> = { good: 3, wip: 2, early: 1, info: 0 };
export const statusRank = (p: Project) => (p.status ? TONE_RANK[p.status.tone] : -1);

/** The latest commit by the project's author, or the last push. */
export const lastActivity = (p: Project) => p.commits[0]?.date ?? p.updatedAt;
