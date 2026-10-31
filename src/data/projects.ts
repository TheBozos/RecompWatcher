// The projects shown on the site. Everything else (README, status, platforms,
// screenshots, downloads) is pulled from GitHub at build time.
//
// To add downloads before cutting a GitHub release, fill `downloads` by hand.
// Once a repo has a release, its assets show up automatically.

export const OWNER = 'boubou666';

export type Kind = 'game' | 'tool';

export interface ManualDownload {
  label: string;
  url: string;
  os?: 'windows' | 'linux' | 'macos' | 'any';
}

export interface ProjectConfig {
  slug: string;
  repo: string;
  /** Repo owner, when it is not OWNER (e.g. a fork's upstream). */
  owner?: string;
  title: string;
  /** Two to four letters drawn on the save icon. */
  short: string;
  kind: Kind;
  /** PS2 disc serial(s), e.g. SCUS-97111. */
  serial?: string;
  region?: string;
  /** Original system the project targets. */
  system: string;
  /** Icon hue, 0-360. */
  hue: number;
  downloads?: ManualDownload[];
}

export const projects: ProjectConfig[] = [
  {
    slug: 'twisted-metal-black',
    repo: 'TMB_Recomp',
    title: 'Twisted Metal: Black',
    short: 'TMB',
    kind: 'game',
    serial: 'SCUS-97101 · SCES-50360',
    region: 'NTSC-U · PAL',
    system: 'PlayStation 2',
    hue: 8,
  },
  {
    slug: 'valkyrie-profile-2',
    repo: 'VP2S_Recomp',
    title: 'Valkyrie Profile 2: Silmeria',
    short: 'VP2',
    kind: 'game',
    serial: 'SLES-54645',
    region: 'PAL',
    system: 'PlayStation 2',
    hue: 205,
  },
  {
    slug: 'lotr-third-age',
    repo: 'TLOTR_TTA_Recomp',
    title: 'The Lord of the Rings: The Third Age',
    short: 'LotR',
    kind: 'game',
    serial: 'SLUS-21027',
    region: 'NTSC-U',
    system: 'PlayStation 2',
    hue: 42,
  },
  {
    slug: 'dark-cloud',
    repo: 'DC_Recomp',
    title: 'Dark Cloud',
    short: 'DC',
    kind: 'game',
    serial: 'SCUS-97111',
    region: 'NTSC-U',
    system: 'PlayStation 2',
    hue: 268,
  },
  {
    slug: 'jade-cocoon-2',
    repo: 'JC2_Recomp',
    title: 'Jade Cocoon 2',
    short: 'JC2',
    kind: 'game',
    serial: 'SLUS-20309',
    region: 'NTSC-U',
    system: 'PlayStation 2',
    hue: 150,
  },
  {
    slug: 'drakengard',
    repo: 'Drakengard_Recomp',
    title: 'Drakengard',
    short: 'DoD',
    kind: 'game',
    serial: 'SLES-52322',
    region: 'PAL',
    system: 'PlayStation 2',
    hue: 352,
  },
  {
    slug: 'ps2recomp',
    repo: 'PS2Recomp',
    title: 'PS2Recomp',
    short: 'EE',
    kind: 'tool',
    system: 'PlayStation 2',
    hue: 220,
  },
  {
    slug: 'ps2-network-recomp',
    repo: 'PS2_Network_Recomp',
    title: 'PS2 Network Recomp',
    short: 'NET',
    kind: 'tool',
    system: 'PlayStation 2',
    hue: 185,
  },
  {
    slug: 'virtual-boy-recomp',
    repo: 'VirtualBoyRecomp',
    title: 'VirtualBoyRecomp',
    short: 'VB',
    kind: 'tool',
    system: 'Virtual Boy',
    hue: 0,
  },
];
