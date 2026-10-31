// A minimal ISO 9660 reader for disc images, run entirely in the browser.
// It reads only the directory sectors and the files asked for, through
// Blob.slice, so a multi-gigabyte image never has to fit in memory.
// Handles plain 2048-byte-sector images (.iso, PS2 DVDs) and raw 2352-byte
// CD images (.bin, Mode 1 and Mode 2).

export interface DiscEntry {
  path: string;
  name: string;
  size: number;
  lba: number;
}

interface Layout {
  sectorSize: number;
  dataOffset: number;
}

const DATA = 2048;
const CHUNK_SECTORS = 1024;

async function slice(blob: Blob, start: number, length: number) {
  return new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
}

async function detect(image: Blob): Promise<Layout | null> {
  const layouts: Layout[] = [
    { sectorSize: 2048, dataOffset: 0 },
    { sectorSize: 2352, dataOffset: 24 }, // Mode 2 (PS1/PS2 CDs)
    { sectorSize: 2352, dataOffset: 16 }, // Mode 1
  ];
  for (const layout of layouts) {
    const b = await slice(image, 16 * layout.sectorSize + layout.dataOffset, 6);
    if (b[0] === 1 && String.fromCharCode(...b.subarray(1, 6)) === 'CD001') return layout;
  }
  return null;
}

async function readExtent(image: Blob, layout: Layout, lba: number, size: number): Promise<Uint8Array> {
  if (layout.sectorSize === DATA) return slice(image, lba * DATA, size);
  const out = new Uint8Array(size);
  const sectors = Math.ceil(size / DATA);
  for (let s = 0; s < sectors; s += CHUNK_SECTORS) {
    const n = Math.min(CHUNK_SECTORS, sectors - s);
    const raw = await slice(image, (lba + s) * layout.sectorSize, n * layout.sectorSize);
    for (let i = 0; i < n; i++) {
      const at = (s + i) * DATA;
      const take = Math.min(DATA, size - at);
      const from = i * layout.sectorSize + layout.dataOffset;
      out.set(raw.subarray(from, from + take), at);
    }
  }
  return out;
}

const latin1 = new TextDecoder('latin1');

async function walk(image: Blob, layout: Layout, lba: number, size: number, prefix: string, out: DiscEntry[], depth: number) {
  const dir = await readExtent(image, layout, lba, size);
  let i = 0;
  while (i < dir.length) {
    const len = dir[i];
    if (len === 0) {
      // Records never straddle sectors; zero padding means "next sector".
      i = (Math.floor(i / DATA) + 1) * DATA;
      continue;
    }
    const view = new DataView(dir.buffer, dir.byteOffset + i, len);
    const extent = view.getUint32(2, true);
    const dataLength = view.getUint32(10, true);
    const isDir = (dir[i + 25] & 2) !== 0;
    const nameLength = dir[i + 32];
    const raw = dir.subarray(i + 33, i + 33 + nameLength);
    i += len;
    if (nameLength === 1 && raw[0] <= 1) continue; // "." and ".."
    const name = latin1.decode(raw).replace(/;\d+$/, '').replace(/\.$/, '');
    if (isDir) {
      if (depth < 8) await walk(image, layout, extent, dataLength, `${prefix}${name}/`, out, depth + 1);
    } else {
      out.push({ path: prefix + name, name, size: dataLength, lba: extent });
    }
  }
}

export interface Disc {
  files: DiscEntry[];
  read(entry: DiscEntry): Promise<Uint8Array>;
}

/** Opens a disc image, or returns null when it is not ISO 9660. */
export async function openDisc(image: Blob): Promise<Disc | null> {
  const layout = await detect(image);
  if (!layout) return null;
  const pvd = await readExtent(image, layout, 16, DATA);
  const root = new DataView(pvd.buffer, pvd.byteOffset + 156, 34);
  const files: DiscEntry[] = [];
  await walk(image, layout, root.getUint32(2, true), root.getUint32(10, true), '', files, 0);
  return { files, read: (e) => readExtent(image, layout, e.lba, e.size) };
}

/** The executable a PS2 disc boots, from SYSTEM.CNF ("BOOT2 = cdrom0:\SLUS_210.27;1"). */
export function bootFile(systemCnf: string): string | undefined {
  return systemCnf.match(/BOOT2?\s*=\s*cdrom0?:\\?([^;\s]+)/i)?.[1]?.split('\\').pop();
}
