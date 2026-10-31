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

/**
 * A file at a fixed commit, from raw.githubusercontent.com (outside the API
 * rate limit). Content at a commit never changes, so it is cached for good.
 */
async function rawAt(owner: string, repo: string, sha: string, file: string): Promise<string> {
  const cacheFile = path.join(CACHE_DIR, 'raw', `${owner}_${repo}_${sha}_${file.replace(/[^a-z0-9.]+/gi, '_')}`);
  if (!process.env.CI) {
    try {
      return await readFile(cacheFile, 'utf8');
    } catch {}
  }
  const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${file}`);
  if (!res.ok) throw new Error(`raw ${repo}@${sha}/${file}: ${res.status}`);
  const text = await res.text();
  if (!process.env.CI) {
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, text);
  }
  return text;
}

interface UserResponse {
  login: string;
  name: string | null;
  html_url: string;
  avatar_url: string;
}

interface CommitResponse {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: { message: string; author: { date: string } };
}

interface RepoResponse {
  html_url: string;
  created_at: string;
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

/** A game file the port is built against, from the README's SHA-1 table. */
export interface DiscFile {
  file: string;
  sha1: string;
  release?: string;
}

export interface Commit {
  sha: string;
  url: string;
  /** First line of the commit message. */
  title: string;
  date: string;
}

export type Step = 'done' | 'wip' | 'todo';

/** A README table whose rows are ticked off with ✅ / 🔧 / ⏳. */
export interface Checklist {
  /** The table's first header, e.g. "Milestone" or "Layer". */
  label: string;
  items: { html: string; text: string; step: Step }[];
}

/** A point where the README's status badge changed. */
export interface Milestone {
  date: string;
  status: string;
  tone: Tone;
  commit: Commit;
}

/** Who makes a project: its repo's owner on GitHub. */
export interface Author {
  login: string;
  name?: string;
  url: string;
  /** Small optimised avatar. */
  avatar: string;
  /** The original avatar URL, for build-time image work (share cards). */
  avatarSource: string;
}

export interface Release {
  tag: string;
  name: string;
  url: string;
  date: string;
  prerelease: boolean;
}

export interface Project extends ProjectConfig {
  owner: string;
  author: Author;
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
  /** Full-size URL of the main screenshot (the icon's front face), if any. */
  cover?: string;
  /**
   * Files a player's copy must match. `any`: one of them (alternative
   * releases); `all`: every one.
   */
  disc: { files: DiscFile[]; mode: 'any' | 'all' };
  /** The README's milestone table, if it has one. */
  milestones?: Checklist;
  /** A checklist of native-port layers (e.g. a "Layer" table), if any. */
  nativeLayers?: Checklist;
  updatedAt: string;
  createdAt: string;
  /** Status changes, oldest first. */
  statusHistory: Milestone[];
  /** Latest commits by the owner, newest first. */
  commits: Commit[];
  stars: number;
  language?: string;
  license?: string;
  upstream?: { name: string; url: string };
  /** The latest published release, and all of them (newest first). */
  release?: Release;
  releases: Release[];
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

/**
 * The first README table with a SHA-1 column, e.g.
 * | Release | File | SHA-1 |  or  | File | SHA-1 |.
 * A Release column means the rows are alternatives.
 */
function parseDiscTable(html: string): Project['disc'] {
  for (const [, table] of html.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    const heads = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => stripTags(m[1]));
    const shaCol = heads.findIndex((h) => /sha-?1/i.test(h));
    const fileCol = heads.findIndex((h) => /file/i.test(h));
    if (shaCol < 0 || fileCol < 0) continue;
    const releaseCol = heads.findIndex((h) => /release|region|version/i.test(h));
    const files: DiscFile[] = [];
    for (const [, row] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripTags(m[1]));
      const sha1 = cells[shaCol]?.toLowerCase();
      if (!sha1 || !/^[0-9a-f]{40}$/.test(sha1)) continue;
      files.push({ file: cells[fileCol], sha1, release: releaseCol >= 0 ? cells[releaseCol] : undefined });
    }
    if (files.length) return { files, mode: releaseCol >= 0 ? 'any' : 'all' };
  }
  return { files: [], mode: 'all' };
}

const toRelease = (r: ReleaseResponse): Release => ({
  tag: r.tag_name,
  name: r.name || r.tag_name,
  url: r.html_url,
  date: r.published_at,
  prerelease: r.prerelease,
});

const toCommit = (c: CommitResponse): Commit => ({
  sha: c.sha,
  url: c.html_url,
  title: c.commit.message.split('\n')[0],
  date: c.commit.author.date,
});

/** The status badge in a README's Markdown source. */
function statusOf(markdown: string) {
  for (const [url] of markdown.matchAll(/https:\/\/img\.shields\.io\/badge\/[^)\s"?]+/g)) {
    const badge = parseBadge(url);
    if (badge?.label === 'status') return { text: badge.message, tone: toneFor(badge.color) };
  }
  return undefined;
}

/**
 * Walks the README's history (up to its last 100 commits) and keeps each
 * commit where the status badge changed.
 */
async function statusHistory(owner: string, repo: string, base: string): Promise<Milestone[]> {
  const history = await gh<CommitResponse[]>(`${base}/commits?path=README.md&per_page=100`).catch(() => []);
  const versions = await Promise.all(
    history.map(async (c) => ({ commit: toCommit(c), status: statusOf(await rawAt(owner, repo, c.sha, 'README.md').catch(() => '')) })),
  );
  const milestones: Milestone[] = [];
  for (const { commit, status } of versions.reverse()) {
    if (!status || status.text === milestones.at(-1)?.status) continue;
    milestones.push({ date: commit.date, status: status.text, tone: status.tone, commit });
  }
  return milestones;
}

/** The milestone table, and a table about native layers (LotR's "Layer"), when present. */
function pickChecklists(lists: Checklist[]) {
  const native = lists.find((l) => /layer|native|part/i.test(l.label));
  const milestones = lists.find((l) => /milestone/i.test(l.label)) ?? lists.find((l) => l !== native);
  return { milestones, nativeLayers: native };
}

const STEP_MARKS: [RegExp, Step][] = [
  [/✅|✔️?|☑️?/u, 'done'],
  [/🔧|🚧|🔨/u, 'wip'],
  [/⏳|❌|⬜/u, 'todo'],
];

/** Every README table whose last column holds ✅ / 🔧 / ⏳ marks. */
function parseChecklists(html: string): Checklist[] {
  const lists: Checklist[] = [];
  for (const [, table] of html.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    const label = stripTags(table.match(/<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? '');
    const items: Checklist['items'] = [];
    for (const [, row] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].trim());
      if (cells.length < 2) continue;
      const mark = stripTags(cells.at(-1)!);
      const step = STEP_MARKS.find(([re]) => re.test(mark))?.[1];
      if (step) items.push({ html: cells[0], text: stripTags(cells[0]), step });
    }
    // Most rows must carry a mark, so a table that merely mentions ✅ is skipped.
    const rows = table.match(/<tr>/g)?.length ?? 0;
    if (items.length >= 3 && items.length >= (rows - 1) * 0.6) lists.push({ label: label || 'Milestone', items });
  }
  return lists;
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
  const user = await gh<UserResponse>(`/users/${owner}`);
  const author: Author = {
    login: user.login,
    name: user.name ?? undefined,
    url: user.html_url,
    avatar: await optimise(user.avatar_url, 64, 64),
    avatarSource: user.avatar_url,
  };
  const base = `/repos/${owner}/${cfg.repo}`;
  const [repo, readme, releases, shotDir, statusChanges, commits] = await Promise.all([
    gh<RepoResponse>(base),
    gh<string>(`${base}/readme`, 'application/vnd.github.html').catch(() => ''),
    gh<ReleaseResponse[]>(`${base}/releases?per_page=10`).catch(() => [] as ReleaseResponse[]),
    gh<ContentEntry[]>(`${base}/contents/docs/screenshots`).catch(() => [] as ContentEntry[]),
    statusHistory(owner, cfg.repo, base),
    gh<CommitResponse[]>(`${base}/commits?per_page=40`).catch(() => [] as CommitResponse[]),
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
    owner,
    author,
    url: repo.html_url,
    description: repo.description ?? '',
    tagline,
    readmeHtml,
    platforms: platformBadge ? platformBadge.message.split('|').map((s) => s.trim()) : [],
    status: statusBadge ? { text: statusBadge.message, tone: toneFor(statusBadge.color) } : undefined,
    screenshots,
    faces,
    cover: faceSources[0],
    disc: parseDiscTable(readmeHtml),
    updatedAt: repo.pushed_at,
    createdAt: repo.created_at,
    statusHistory: statusChanges,
    ...pickChecklists(parseChecklists(readmeHtml)),
    // Only the owner's commits: a fork's history is mostly upstream's.
    commits: commits
      .filter((c) => c.author?.login?.toLowerCase() === owner.toLowerCase())
      .slice(0, 8)
      .map(toCommit),
    stars: repo.stargazers_count,
    language: repo.language ?? undefined,
    license: repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : undefined,
    upstream: repo.fork && repo.parent ? { name: repo.parent.full_name, url: repo.parent.html_url } : undefined,
    release: release && toRelease(release),
    releases: releases.filter((r) => !r.draft).map(toRelease),
    downloads,
  };
}

let all: Promise<Project[]> | undefined;
export function getProjects(): Promise<Project[]> {
  return (all ??= Promise.all(projects.map(load)));
}
