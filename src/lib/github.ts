// Build-time GitHub access: repo metadata, the README as GitHub renders it, and
// the latest release's assets. Responses are memoised per build and cached on
// disk for an hour so `astro dev` does not burn through the API rate limit.

import { getImage } from 'astro:assets';
import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OWNER, projects, type ManualDownload, type ProjectConfig } from '../data/projects';

const API = 'https://api.github.com';
const CACHE_DIR = path.resolve('.cache/github');
const CACHE_TTL_MS = 60 * 60 * 1000;

function resolveToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync('gh auth token', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined;
  } catch {
    return undefined;
  }
}
const token = resolveToken();

const inflight = new Map<string, Promise<unknown>>();

async function gh<T>(endpoint: string, accept = 'application/vnd.github+json'): Promise<T> {
  const key = `${accept} ${endpoint}`;
  if (!inflight.has(key)) inflight.set(key, fetchCached<T>(endpoint, accept));
  return inflight.get(key) as Promise<T>;
}

async function fetchCached<T>(endpoint: string, accept: string): Promise<T> {
  const useCache = !process.env.CI;
  const file = path.join(CACHE_DIR, `${endpoint.replace(/[^a-z0-9]+/gi, '_')}${accept.includes('html') ? '.html' : ''}.json`);
  if (useCache) {
    try {
      const cached = JSON.parse(await readFile(file, 'utf8'));
      if (Date.now() - cached.at < CACHE_TTL_MS) return cached.body as T;
    } catch {}
  }

  const res = await fetch(API + endpoint, {
    headers: {
      Accept: accept,
      'User-Agent': 'recomp-watcher',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${endpoint}: ${res.status} ${res.statusText}`);
  const body = (accept.includes('html') ? await res.text() : await res.json()) as T;

  if (useCache) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), body }));
  }
  return body;
}

interface RepoResponse {
  html_url: string;
  description: string | null;
  default_branch: string;
  pushed_at: string;
  stargazers_count: number;
  language: string | null;
  license: { spdx_id: string } | null;
  fork: boolean;
  parent?: { full_name: string; html_url: string };
}

interface ContentEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

interface ReleaseResponse {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; size: number; browser_download_url: string; download_count: number }[];
}

export type Os = 'windows' | 'linux' | 'macos' | 'any';
export type Tone = 'good' | 'wip' | 'early' | 'info';

export interface Download {
  label: string;
  url: string;
  os: Os;
  size?: number;
}

export interface Project extends ProjectConfig {
  url: string;
  description: string;
  tagline: string;
  readmeHtml: string;
  platforms: string[];
  status?: { text: string; tone: Tone };
  /** Full-size image, a small optimised copy for the gallery, and a caption. */
  screenshots: { src: string; thumb: string; alt: string }[];
  /** Optimised square images for the save icon's faces; empty means letters. */
  faces: string[];
  updatedAt: string;
  stars: number;
  language?: string;
  license?: string;
  upstream?: { name: string; url: string };
  release?: { tag: string; name: string; url: string; date: string; prerelease: boolean };
  downloads: Download[];
}

// --- README post-processing -------------------------------------------------

const isRelative = (u: string) => !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function rewriteReadme(html: string, owner: string, repo: string, branch: string) {
  const raw = (p: string) => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p.replace(/^\.?\//, '')}`;
  const blob = (p: string) => `https://github.com/${owner}/${repo}/blob/${branch}/${p.replace(/^\.?\//, '')}`;

  return (
    html
      // Unwrap GitHub's page chrome.
      .replace(/^<div id="readme"[^>]*><article[^>]*>/, '')
      .replace(/<\/article><\/div>\s*$/, '')
      // Heading permalink icons: keep the anchor target, drop the octicon.
      .replace(/<a id="(user-content-[^"]+)" class="anchor"[^>]*>[\s\S]*?<\/a>/g, '<span id="$1" class="anchor"></span>')
      .replace(/(<img[^>]*?\ssrc=")([^"]+)"/g, (_, pre, src) => `${pre}${isRelative(src) ? raw(src) : src}"`)
      .replace(/(<a[^>]*?\shref=")([^"]+)"/g, (_, pre, href) => {
        if (href.startsWith('#') && !href.startsWith('#user-content-')) return `${pre}#user-content-${href.slice(1)}"`;
        if (!isRelative(href)) return `${pre}${href}"`;
        return `${pre}${IMG_EXT.test(href) ? raw(href) : blob(href)}"`;
      })
      // Every outbound link opens a new tab; in-page anchors stay put.
      .replace(/<a (?![^>]*target=)([^>]*href="(?!#))/g, '<a target="_blank" rel="noopener" $1')
  );
}

function stripTags(s: string) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** shields.io static badge path: `label-message-color`, with `--` for a literal dash. */
function parseBadge(url: string) {
  const m = url.match(/img\.shields\.io\/badge\/([^?"]+)/);
  if (!m) return null;
  const parts = m[1].replace(/--/g, '\0').split('-');
  if (parts.length < 3) return null;
  const decode = (s: string) => decodeURIComponent(s.replace(/\0/g, '-').replace(/__/g, '\u0001').replace(/_/g, ' ').replace(/\u0001/g, '_'));
  return {
    label: decode(parts[0]).toLowerCase(),
    message: decode(parts.slice(1, -1).join('-')),
    color: parts.at(-1)!.toLowerCase(),
  };
}

function toneFor(color: string): Tone {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/.test(hex)) return 'info';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (g > r && g > b) return 'good';
  if (r > 180 && g > 120) return 'wip';
  if (r > g && r > b) return 'early';
  return 'info';
}

function osOf(name: string): Os {
  const n = name.toLowerCase();
  if (/win|\.exe$|\.msi$/.test(n)) return 'windows';
  if (/mac|darwin|osx|\.dmg$/.test(n)) return 'macos';
  if (/linux|\.appimage$|\.deb$|\.rpm$/.test(n)) return 'linux';
  return 'any';
}

/** "2026-10-29-black-rider.png" -> "Black rider" */
function captionFromFile(name: string) {
  const words = name
    .replace(/\.[a-z]+$/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A cropped WebP copy made at build time, so pages never load full-size PNGs. */
async function optimise(src: string, width: number, height: number) {
  const img = await getImage({ src, width, height, fit: 'cover', format: 'webp', quality: 72 });
  return img.src;
}

// --- Public API ---------------------------------------------------------------

async function load(cfg: ProjectConfig): Promise<Project> {
  const owner = cfg.owner ?? OWNER;
  const base = `/repos/${owner}/${cfg.repo}`;
  const [repo, readme, releases, shotDir] = await Promise.all([
    gh<RepoResponse>(base),
    gh<string>(`${base}/readme`, 'application/vnd.github.html').catch(() => ''),
    gh<ReleaseResponse[]>(`${base}/releases?per_page=10`).catch(() => [] as ReleaseResponse[]),
    gh<ContentEntry[]>(`${base}/contents/docs/screenshots`).catch(() => [] as ContentEntry[]),
  ]);
  const raw = (p: string) => `https://raw.githubusercontent.com/${owner}/${cfg.repo}/${repo.default_branch}/${p}`;

  let readmeHtml = rewriteReadme(readme, owner, cfg.repo, repo.default_branch);

  const badges = [...readmeHtml.matchAll(/data-canonical-src="([^"]+)"/g)]
    .map((m) => parseBadge(m[1]))
    .filter((b): b is NonNullable<typeof b> => !!b);
  const platformBadge = badges.find((b) => b.label === 'platform');
  const statusBadge = badges.find((b) => b.label === 'status');

  // Screenshots: the README's own images first (with their captions), then
  // anything else in docs/screenshots/, captioned from the file name.
  const shots = new Map<string, string>();
  for (const [tag] of readmeHtml.matchAll(/<img[^>]*>/g)) {
    const src = tag.match(/\ssrc="(https:\/\/raw\.githubusercontent\.com\/[^"]+)"/)?.[1];
    if (src && IMG_EXT.test(src)) shots.set(src, stripTags(tag.match(/\salt="([^"]*)"/)?.[1] ?? ''));
  }
  for (const f of shotDir) {
    if (f.type !== 'file' || !IMG_EXT.test(f.name) || shots.has(raw(f.path))) continue;
    shots.set(raw(f.path), captionFromFile(f.name));
  }
  const screenshots = await Promise.all(
    [...shots].map(async ([src, alt]) => ({ src, alt, thumb: await optimise(src, 640, 480) })),
  );
  const faceSources = cfg.faces?.map(raw) ?? [...shots.keys()].slice(0, 4);
  const faces = await Promise.all(faceSources.map((src) => optimise(src, 200, 200)));

  // The README opens with the title and a bold tagline; the page shows both
  // already, so pull the tagline out and drop the duplicated heading.
  const lead = readmeHtml.match(/<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>/);
  const tagline = lead ? stripTags(lead[1]) : (repo.description ?? '');
  readmeHtml = readmeHtml.replace(/<div class="markdown-heading"[^>]*><h1[\s\S]*?<\/h1>[\s\S]*?<\/div>/, '');
  if (lead) readmeHtml = readmeHtml.replace(/<p[^>]*>\s*<strong>[\s\S]*?<\/p>/, '');

  const release = releases.find((r) => !r.draft);
  const downloads: Download[] = [
    ...(cfg.downloads ?? []).map((d: ManualDownload) => ({ label: d.label, url: d.url, os: d.os ?? osOf(d.label) })),
    ...(release?.assets ?? []).map((a) => ({ label: a.name, url: a.browser_download_url, os: osOf(a.name), size: a.size })),
  ];

  return {
    ...cfg,
    url: repo.html_url,
    description: repo.description ?? '',
    tagline,
    readmeHtml,
    platforms: platformBadge ? platformBadge.message.split('|').map((s) => s.trim()) : [],
    status: statusBadge ? { text: statusBadge.message, tone: toneFor(statusBadge.color) } : undefined,
    screenshots,
    faces,
    updatedAt: repo.pushed_at,
    stars: repo.stargazers_count,
    language: repo.language ?? undefined,
    license: repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : undefined,
    upstream: repo.fork && repo.parent ? { name: repo.parent.full_name, url: repo.parent.html_url } : undefined,
    release: release && {
      tag: release.tag_name,
      name: release.name || release.tag_name,
      url: release.html_url,
      date: release.published_at,
      prerelease: release.prerelease,
    },
    downloads,
  };
}

let all: Promise<Project[]> | undefined;
export function getProjects(): Promise<Project[]> {
  return (all ??= Promise.all(projects.map(load)));
}
