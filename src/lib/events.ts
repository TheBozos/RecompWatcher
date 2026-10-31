// What happened to each project and when: releases, status changes and the
// project's start. Feeds the RSS feed and the Browser's NEW badges.

import type { Project } from './github';

export type EventKind = 'release' | 'status' | 'start';

export interface ProjectEvent {
  kind: EventKind;
  date: string;
  project: Project;
  title: string;
  description: string;
  /** Where the event is best seen: a release page, or the project's page. */
  link: string;
}

export function eventsOf(p: Project, pageUrl: string): ProjectEvent[] {
  return [
    ...p.releases.map((r) => ({
      kind: 'release' as const,
      date: r.date,
      project: p,
      title: `${p.title}: ${r.name} released${r.prerelease ? ' (pre-release)' : ''}`,
      description: `A new build of ${p.title} by ${p.author.login} is available to download.`,
      link: r.url,
    })),
    ...p.statusHistory.slice(1).map((m) => ({
      kind: 'status' as const,
      date: m.date,
      project: p,
      title: `${p.title} is now "${m.status}"`,
      description: `${p.title} (by ${p.author.login}) moved to "${m.status}". ${m.commit.title}`,
      // Each step of the timeline has its own anchor, which also keeps feed item ids unique.
      link: `${pageUrl}#status-${m.commit.sha.slice(0, 7)}`,
    })),
    {
      kind: 'start' as const,
      date: p.createdAt,
      project: p,
      title: `${p.title}: ${p.kind === 'game' ? 'a new port' : 'a new tool'} by ${p.author.login}`,
      description: p.tagline || p.description,
      link: pageUrl,
    },
  ].sort((a, b) => b.date.localeCompare(a.date));
}

/** How long each kind of event keeps its badge on the Browser. */
export const BADGE_DAYS: Record<EventKind, number> = { release: 14, status: 5, start: 5 };
