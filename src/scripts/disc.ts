// The disc checker on game pages: the visitor drops their game's files, a
// folder copied from the disc, or a whole disc image, and each relevant file is
// SHA-1 hashed in the browser and compared with the versions the port is built
// against. Nothing is uploaded anywhere.

import { bootFile, openDisc } from './iso';
import { play } from './sound';
import { tc } from '../i18n';

interface DiscFile {
  file: string;
  sha1: string;
  release?: string;
}
interface Known extends DiscFile {
  slug: string;
  title: string;
  href: string;
}
interface Data {
  slug: string;
  title: string;
  mode: 'any' | 'all';
  files: DiscFile[];
  known: Known[];
}

type Verdict = 'ok' | 'other-game' | 'other-version' | 'unknown' | 'error';
interface Result {
  verdict: Verdict;
  name: string;
  from?: string;
  detail: string;
  sha1?: string;
  link?: { href: string; text: string };
}

const IMAGE_EXT = /\.(iso|bin|img|mdf|nrg)$/i;
const COMPRESSED_EXT = /\.(chd|cso|zso|7z|zip|rar|gz|xz|ecm)$/i;
const MAX_LOOSE_FILE = 1.5e9;

const upper = (s: string) => s.toUpperCase();

async function sha1(data: BufferSource) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', data));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setup(root: HTMLElement) {
  const data: Data = JSON.parse(root.querySelector('[data-disc-data]')!.textContent!);
  const knownNames = new Set(data.known.map((k) => upper(k.file)));
  const input = root.querySelector<HTMLInputElement>('[data-disc-input]')!;
  const drop = root.querySelector<HTMLElement>('[data-drop]')!;
  const results = root.querySelector<HTMLElement>('[data-results]')!;
  const verdict = root.querySelector<HTMLElement>('[data-verdict]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const matched = new Set<string>();
  const seen: Result[] = [];

  function classify(name: string, hash: string, from?: string): Result {
    const mine = data.files.find((f) => f.sha1 === hash);
    if (mine) {
      matched.add(hash);
      return {
        verdict: 'ok',
        name,
        from,
        sha1: hash,
        detail: mine.release ? tc('dSupportedRelease', { file: mine.file, release: mine.release }) : tc('dSupported', { file: mine.file }),
      };
    }
    const elsewhere = data.known.find((k) => k.sha1 === hash);
    if (elsewhere) {
      return {
        verdict: 'other-game',
        name,
        from,
        sha1: hash,
        detail: tc('dOtherGame', {
          title: elsewhere.title,
          file: elsewhere.file,
          release: elsewhere.release ? ` (${elsewhere.release})` : '',
          current: data.title,
        }),
        link: { href: elsewhere.href, text: tc('dGoTo', { title: elsewhere.title }) },
      };
    }
    const sameName = data.files.find((f) => upper(f.file) === upper(name));
    if (sameName) {
      return {
        verdict: 'other-version',
        name,
        from,
        sha1: hash,
        detail: tc('dOtherVersion', { file: sameName.file }),
      };
    }
    const otherName = data.known.find((k) => upper(k.file) === upper(name) && k.slug !== data.slug);
    if (otherName) {
      return {
        verdict: 'other-game',
        name,
        from,
        sha1: hash,
        detail: tc('dOtherName', { name, title: otherName.title, current: data.title }),
        link: { href: otherName.href, text: tc('dGoTo', { title: otherName.title }) },
      };
    }
    return {
      verdict: 'unknown',
      name,
      from,
      sha1: hash,
      detail: tc('dUnknown', { files: data.files.map((f) => f.file).join(tc('dOr')) }),
    };
  }

  /** Hash the files that matter on a disc image or a copied disc folder. */
  async function checkSet(
    label: string,
    entries: { name: string; size: number; read: () => Promise<BufferSource> }[],
  ): Promise<Result[]> {
    const cnf = entries.find((e) => upper(e.name) === 'SYSTEM.CNF');
    const boot = cnf && bootFile(new TextDecoder().decode(await cnf.read()));
    const wanted = entries.filter((e) => knownNames.has(upper(e.name)) || (boot && upper(e.name) === upper(boot)));
    if (!wanted.length) {
      return [
        {
          verdict: 'unknown',
          name: label,
          detail: boot
            ? tc('dBootsOther', { boot })
            : tc('dNoneOnDisc', { files: data.files.map((f) => f.file).join(', ') }),
        },
      ];
    }
    const out: Result[] = [];
    for (const e of wanted) {
      status.textContent = tc('dChecking', { name: e.name });
      out.push(classify(e.name, await sha1(await e.read()), label));
    }
    return out;
  }

  async function checkFile(file: File): Promise<Result[]> {
    if (COMPRESSED_EXT.test(file.name)) {
      return [{ verdict: 'error', name: file.name, detail: tc('dCompressed') }];
    }
    if (IMAGE_EXT.test(file.name) || file.size > 64e6) {
      status.textContent = tc('dReading', { name: file.name });
      const disc = await openDisc(file);
      if (disc) {
        return checkSet(
          file.name,
          disc.files.map((f) => ({ name: f.name, size: f.size, read: () => disc.read(f) as Promise<BufferSource> })),
        );
      }
      if (IMAGE_EXT.test(file.name)) {
        return [{ verdict: 'error', name: file.name, detail: tc('dNotIso') }];
      }
    }
    if (file.size > MAX_LOOSE_FILE) {
      return [{ verdict: 'error', name: file.name, detail: tc('dTooLarge') }];
    }
    status.textContent = tc('dChecking', { name: file.name });
    return [classify(file.name, await sha1(await file.arrayBuffer()))];
  }

  function render() {
    results.replaceChildren(
      ...seen.map((r) => {
        const li = el('li', `result ${r.verdict}`);
        li.append(el('span', 'mark'));
        const body = el('div');
        const title = el('strong', undefined, r.name);
        body.append(title);
        if (r.from) body.append(el('small', 'from', tc('dIn', { from: r.from })));
        body.append(el('p', undefined, r.detail));
        if (r.sha1) body.append(el('code', undefined, `SHA-1 ${r.sha1}`));
        if (r.link) {
          const a = el('a', undefined, `${r.link.text} →`);
          a.href = r.link.href;
          body.append(a);
        }
        li.append(body);
        return li;
      }),
    );

    for (const row of root.querySelectorAll<HTMLElement>('[data-expect]')) {
      row.classList.toggle('matched', matched.has(row.dataset.expect!));
    }

    const done = data.mode === 'any' ? matched.size > 0 : data.files.every((f) => matched.has(f.sha1));
    let tone: 'ok' | 'warn' | 'bad' = 'bad';
    let text: string;
    if (done) {
      tone = 'ok';
      text = tc('dVerdictOk');
    } else if (matched.size) {
      tone = 'warn';
      const missing = data.files.filter((f) => !matched.has(f.sha1)).map((f) => f.file);
      text = tc('dVerdictSoFar', { files: missing.join(', ') });
    } else if (seen.some((r) => r.verdict === 'other-game')) {
      text = tc('dVerdictOtherGame');
    } else if (seen.some((r) => r.verdict === 'other-version')) {
      text = tc('dVerdictOtherVersion');
    } else {
      text = tc('dVerdictNone');
    }
    verdict.hidden = false;
    verdict.dataset.tone = tone;
    verdict.textContent = text;
    play(tone === 'ok' ? 'confirm' : 'back');
  }

  async function run(work: () => Promise<Result[]>) {
    root.classList.add('busy');
    status.textContent = tc('dCheckingDisc');
    try {
      seen.unshift(...(await work()));
    } catch (err) {
      seen.unshift({ verdict: 'error', name: tc('dReadError'), detail: String((err as Error)?.message ?? err) });
    } finally {
      root.classList.remove('busy');
      status.textContent = '';
      render();
    }
  }

  async function handleFiles(files: File[]) {
    // One at a time: a disc image can be gigabytes.
    await run(async () => {
      const out: Result[] = [];
      for (const f of files) out.push(...(await checkFile(f)));
      return out;
    });
  }

  /** A dropped folder (a copy of the disc): find SYSTEM.CNF and the known files in it. */
  async function handleFolder(dir: FileSystemDirectoryEntry) {
    await run(async () => {
      const files: File[] = [];
      const walk = async (d: FileSystemDirectoryEntry, depth: number): Promise<void> => {
        const reader = d.createReader();
        for (;;) {
          const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
          if (!batch.length) break;
          for (const entry of batch) {
            if (entry.isDirectory && depth < 4) await walk(entry as FileSystemDirectoryEntry, depth + 1);
            else if (entry.isFile && (knownNames.has(upper(entry.name)) || upper(entry.name) === 'SYSTEM.CNF')) {
              files.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
            }
          }
        }
      };
      await walk(dir, 0);
      return checkSet(
        `${dir.name}/`,
        files.map((f) => ({ name: f.name, size: f.size, read: () => f.arrayBuffer() })),
      );
    });
  }

  input.addEventListener('change', () => {
    if (input.files?.length) void handleFiles([...input.files]);
    input.value = '';
  });
  root.querySelector('[data-pick]')!.addEventListener('click', () => input.click());

  return {
    drop: async (dt: DataTransfer) => {
      const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
      const folders = entries.filter((e) => e.isDirectory) as FileSystemDirectoryEntry[];
      const loose = [...dt.files].filter((f) => !folders.some((d) => d.name === f.name));
      for (const d of folders) await handleFolder(d);
      if (loose.length) await handleFiles(loose);
      drop.focus({ preventScroll: true });
    },
  };
}

// The whole page accepts drops while a checker is on it.
let active: ReturnType<typeof setup> | undefined;
let depth = 0;
const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');

addEventListener('dragenter', (e) => {
  if (!active || !hasFiles(e)) return;
  depth++;
  document.body.classList.add('dragging-files');
});
addEventListener('dragleave', () => {
  if (!active) return;
  depth = Math.max(0, depth - 1);
  if (!depth) document.body.classList.remove('dragging-files');
});
addEventListener('dragover', (e) => {
  if (!active || !hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
});
addEventListener('drop', (e) => {
  depth = 0;
  document.body.classList.remove('dragging-files');
  if (!active || !e.dataTransfer || !hasFiles(e)) return;
  e.preventDefault();
  document.querySelector('[data-disc]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  void active.drop(e.dataTransfer);
});

document.addEventListener('astro:page-load', () => {
  const root = document.querySelector<HTMLElement>('[data-disc]');
  active = root ? setup(root) : undefined;
});
