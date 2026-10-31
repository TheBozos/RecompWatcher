// Share cards: the 1200x630 preview image link unfurlers (Discord, X,
// Reddit, ...) show for a page. Laid out with Satori, rasterised with resvg,
// at build time.

import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';
import type { Project, Step } from './github';

const W = 1200;
const H = 630;

const require = createRequire(import.meta.url);
const font = (weight: number) => readFile(require.resolve(`@fontsource/exo-2/files/exo-2-latin-${weight}-normal.woff`));
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }[]> | undefined;
const loadFonts = () =>
  (fonts ??= Promise.all(
    ([400, 600, 700] as const).map(async (weight) => ({ name: 'Exo 2', data: await font(weight), weight, style: 'normal' as const })),
  ));

/** A remote image as a small JPEG data URI Satori can embed. */
async function embed(url: string | undefined, width: number, height: number) {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(width, height, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return undefined;
  }
}

// Satori takes React-style element objects; this keeps them readable without JSX.
type Node = { type: string; props: Record<string, unknown> } | string;
function h(type: string, style: Record<string, unknown>, ...children: (Node | false | undefined)[]): Node {
  const kids = children.filter((c): c is Node => !!c);
  return { type, props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
}
const img = (src: string, style: Record<string, unknown>): Node => ({ type: 'img', props: { src, style } });

const hsl = (hue: number, s: number, l: number, a = 1) => `hsla(${hue}, ${s}%, ${l}%, ${a})`;
const TONE = { good: '#4fe0a3', wip: '#ffc35c', early: '#ff6b7a', info: '#9aaccf' };

function blocks(steps: Step[], hue: number) {
  return h(
    'div',
    { gap: 4, width: '100%', height: 16 },
    ...steps.map((s) =>
      h('div', {
        flex: 1,
        borderRadius: 3,
        backgroundColor: s === 'done' ? hsl(hue, 90, 66) : s === 'wip' ? hsl(hue, 90, 66, 0.4) : 'rgba(255,255,255,0.1)',
        boxShadow: s === 'done' ? `0 0 8px ${hsl(hue, 90, 60, 0.7)}` : 'none',
      }),
    ),
  );
}

function backdrop(hue: number, ...children: Node[]) {
  return h(
    'div',
    {
      width: W,
      height: H,
      position: 'relative',
      fontFamily: 'Exo 2',
      color: '#e8efff',
      backgroundColor: '#01030a',
      backgroundImage: `radial-gradient(ellipse at 20% 110%, ${hsl(hue, 80, 35, 0.75)} 0%, #030820 45%, #01030a 80%)`,
    },
    // The boot towers, suggested by a row of translucent columns along the bottom.
    h(
      'div',
      { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, alignItems: 'flex-end', gap: 10, padding: '0 20px', opacity: 0.35 },
      ...Array.from({ length: 34 }, (_, i) =>
        h('div', {
          flex: 1,
          height: 30 + ((i * 37) % 110),
          backgroundImage: `linear-gradient(${hsl(220, 90, 70, 0.55)}, ${hsl(220, 90, 50, 0.05)})`,
          borderRadius: 2,
        }),
      ),
    ),
    ...children,
  );
}

const brand = (text = 'RECOMP WATCHER') =>
  h('div', { fontSize: 20, letterSpacing: 5, fontWeight: 700, color: '#cfe0ff' }, text);

/** Lays the card out, rasterises it, and returns a JPEG (a fraction of the PNG's size). */
async function render(node: Node) {
  const svg = await satori(node as never, { width: W, height: H, fonts: await loadFonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

export async function projectCard(p: Project): Promise<Buffer> {
  const [cover, avatar] = await Promise.all([embed(p.cover, 520, 520), embed(p.author.avatarSource, 64, 64)]);
  const ms = p.milestones;
  const done = ms?.items.filter((i) => i.step === 'done').length ?? 0;
  const native = p.nativeLayers;
  const nativeDone = native?.items.filter((i) => i.step === 'done').length ?? 0;

  const art = cover
    ? img(cover, { width: 440, height: 440, borderRadius: 22, objectFit: 'cover', border: `3px solid ${hsl(p.hue, 90, 75, 0.8)}` })
    : h(
        'div',
        {
          width: 440,
          height: 440,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 150,
          fontWeight: 700,
          color: '#fff',
          border: `3px solid ${hsl(p.hue, 90, 75, 0.8)}`,
          backgroundImage: `linear-gradient(135deg, ${hsl(p.hue, 90, 60)}, ${hsl(p.hue, 80, 25)})`,
        },
        p.short,
      );

  return render(
    backdrop(
      p.hue,
      h(
        'div',
        { position: 'absolute', inset: 0, padding: '70px 70px', gap: 56, alignItems: 'center' },
        h('div', { boxShadow: `0 0 70px ${hsl(p.hue, 90, 55, 0.55)}`, borderRadius: 22 }, art),
        h(
          'div',
          { flexDirection: 'column', flex: 1, gap: 18 },
          brand(`RECOMP WATCHER · ${p.kind === 'game' ? 'PC PORT' : 'TOOL'}`),
          h('div', { fontSize: p.title.length > 26 ? 52 : 64, fontWeight: 600, lineHeight: 1.05 }, p.title),
          h(
            'div',
            { alignItems: 'center', gap: 12, fontSize: 28, color: '#9aaccf' },
            p.kind === 'game' ? 'Recompiled by' : 'by',
            avatar && img(avatar, { width: 38, height: 38, borderRadius: 19 }),
            h('div', { color: '#e8efff', fontWeight: 600 }, p.author.login),
          ),
          p.status &&
            h(
              'div',
              { alignItems: 'center', gap: 12, fontSize: 28 },
              h('div', { width: 16, height: 16, borderRadius: 8, backgroundColor: TONE[p.status.tone] }),
              p.status.text,
            ),
          ms &&
            h(
              'div',
              { flexDirection: 'column', gap: 10, marginTop: 6 },
              blocks(
                ms.items.map((i) => i.step),
                p.hue,
              ),
              h('div', { fontSize: 22, color: '#9aaccf' }, `${done} of ${ms.items.length} milestones${native ? ` · native port ${nativeDone} of ${native.items.length}` : ''}`),
            ),
          h('div', { fontSize: 22, color: '#64759a', marginTop: 4 }, [p.serial, p.region, p.platforms.length ? `PC: ${p.platforms.join(' / ')}` : p.system].filter(Boolean).join('  ·  ')),
        ),
      ),
    ),
  );
}

export async function homeCard(all: Project[]): Promise<Buffer> {
  const games = all.filter((p) => p.kind === 'game');
  const authors = [...new Map(games.map((p) => [p.author.login, p.author])).values()];
  const [tiles, avatars] = await Promise.all([
    Promise.all(games.filter((p) => p.cover).slice(0, 8).map(async (p) => ({ p, src: await embed(p.cover, 220, 220) }))),
    Promise.all(authors.map((a) => embed(a.avatarSource, 64, 64))),
  ]);

  return render(
    backdrop(
      220,
      h(
        'div',
        { position: 'absolute', inset: 0, padding: '64px 70px', flexDirection: 'column', gap: 26 },
        h(
          'div',
          { fontSize: 84, letterSpacing: 18, alignItems: 'baseline', gap: 26 },
          h('div', { fontWeight: 700 }, 'RECOMP'),
          h('div', { fontWeight: 400, color: '#9aaccf' }, 'WATCHER'),
        ),
        h('div', { fontSize: 32, color: '#cfe0ff' }, `${games.length} PlayStation 2 games, recompiled into native PC programs`),
        h(
          'div',
          { gap: 18, marginTop: 10 },
          ...tiles
            .filter((t) => t.src)
            .map((t) =>
              img(t.src!, {
                width: 112,
                height: 112,
                borderRadius: 14,
                objectFit: 'cover',
                border: `2px solid ${hsl(t.p.hue, 90, 72, 0.85)}`,
                boxShadow: `0 0 26px ${hsl(t.p.hue, 90, 55, 0.5)}`,
              }),
            ),
        ),
        h(
          'div',
          { alignItems: 'center', gap: 14, fontSize: 26, color: '#9aaccf', marginTop: 8 },
          'by',
          ...authors.flatMap((a, i) => [
            avatars[i] && img(avatars[i]!, { width: 36, height: 36, borderRadius: 18 }),
            h('div', { color: '#e8efff', fontWeight: 600, marginRight: 10 }, a.login),
          ]),
        ),
      ),
    ),
  );
}
