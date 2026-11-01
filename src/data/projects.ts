// The projects shown on the site. Everything else (README, status, platforms,
// screenshots, downloads) is pulled from GitHub at build time.
//
// Screenshots come from the README and from docs/screenshots/ in each repo.
//
// To add downloads before cutting a GitHub release, fill `downloads` by hand.
// Once a repo has a release, its assets show up automatically.

/** Default repo owner; set `owner` on a project made by someone else. */
export const OWNER = 'boubou666';

/**
 * Auto-discovery: any public repo of these people carrying this topic shows
 * up without an entry below (title, serial, region and icon are worked out
 * from the repo). An entry below still wins, to set the title, colour or faces
 * by hand. Topic `recomp-tool` files a repo under tools instead of games.
 */
export const DISCOVER = {
  topic: 'recomp-watcher',
  owners: [OWNER, 'Arzaroth'],
  /** "owner/repo" names never to show. */
  exclude: [] as string[],
};

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
  /**
   * Repo paths of the images on the save icon's faces (front, right, back,
   * left). Without it, the first screenshots found in the repo are used; with
   * none at all, the icon shows `short`.
   */
  faces?: string[];
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
    faces: [
      'docs/screenshots/story_menu.jpg',
      'docs/screenshots/match_night.jpg',
      'docs/screenshots/match_explosion.jpg',
      'docs/screenshots/intro_movie.jpg',
    ],
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
    faces: [
      'docs/screenshots/title.jpg',
      'docs/screenshots/field_town.jpg',
      'docs/screenshots/field_arch.jpg',
      'docs/screenshots/field_dialogue.jpg',
    ],
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
    faces: [
      'docs/screenshots/2026-10-28-title-screen.png',
      'docs/screenshots/2026-10-29-black-rider.png',
      'docs/screenshots/2026-10-29-in-engine-forest.png',
      'docs/screenshots/2026-10-29-first-battle.png',
    ],
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
    faces: [
      'docs/screenshots/title-logo.png',
      'docs/screenshots/genie.png',
      'docs/screenshots/norune-night.png',
      'docs/screenshots/dungeon-scene.png',
    ],
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
    faces: [
      'docs/screenshots/jade-throne-room.png',
      'docs/screenshots/wormhole-forest.png',
      'docs/screenshots/first-scene-levant.png',
      'docs/screenshots/first-scene-room.png',
    ],
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
  // Arzaroth's ports.
  {
    slug: 'soulcalibur-3',
    repo: 'SoulCaliburIII_Recomp',
    owner: 'Arzaroth',
    title: 'Soulcalibur III',
    short: 'SC3',
    kind: 'game',
    serial: 'SLUS-21216',
    region: 'NTSC-U',
    system: 'PlayStation 2',
    hue: 300,
    faces: [
      'docs/screenshots/title_screen.jpg',
      'docs/screenshots/fight.jpg',
      'docs/screenshots/versus.jpg',
      'docs/screenshots/chronicles_field.jpg',
    ],
  },
  {
    slug: 'fighting-for-one-piece',
    repo: 'FightingForOnePiece_Recomp',
    owner: 'Arzaroth',
    title: 'Fighting for One Piece',
    short: 'FfOP',
    kind: 'game',
    serial: 'SLPS-25545',
    region: 'NTSC-J',
    system: 'PlayStation 2',
    hue: 28,
    faces: [
      'docs/screenshots/title_screen.jpg',
      'docs/screenshots/fight.jpg',
      'docs/screenshots/character_select.jpg',
      'docs/screenshots/special_move.jpg',
    ],
  },
  {
    slug: 'smash-court-tennis-2',
    repo: 'SmashCourtTennisProTournament2_Recomp',
    owner: 'Arzaroth',
    title: 'Smash Court Tennis Pro Tournament 2',
    short: 'SCT2',
    kind: 'game',
    serial: 'SLUS-20933',
    region: 'NTSC-U',
    system: 'PlayStation 2',
    hue: 95,
    faces: [
      'docs/screenshots/title_screen.jpg',
      'docs/screenshots/match_play.jpg',
      'docs/screenshots/player_select.jpg',
      'docs/screenshots/final_set.jpg',
    ],
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
