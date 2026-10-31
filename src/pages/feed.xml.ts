// /feed.xml: releases, status changes and new projects across the site.
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { eventsOf } from '../lib/events';
import { getProjects } from '../lib/github';

export const GET: APIRoute = async (context) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const site = new URL(base, context.site ?? 'http://localhost:4321');
  const events = (await getProjects())
    .flatMap((p) => eventsOf(p, new URL(`p/${p.slug}/`, site).href))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);

  return rss({
    title: 'Recomp Watcher',
    description: 'New builds, status changes and new projects: PlayStation 2 games recompiled into native PC programs.',
    site,
    items: events.map((e) => ({
      title: e.title,
      link: e.link,
      pubDate: new Date(e.date),
      description: e.description,
      categories: [e.kind, e.project.author.login],
    })),
  });
};
