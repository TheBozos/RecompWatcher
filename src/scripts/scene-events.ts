// Pages steer the backdrop through these events. The latest state is kept so
// the scene, which loads lazily, can pick it up when it starts.

export type SceneMode = 'boot' | 'menu' | 'page';
export interface SceneEvent {
  mode?: SceneMode;
  hue?: number;
}

export const sceneState: SceneEvent & { modeAt: number } = { mode: 'menu', modeAt: performance.now() };

export function setScene(detail: SceneEvent) {
  if (detail.mode && detail.mode !== sceneState.mode) {
    sceneState.mode = detail.mode;
    sceneState.modeAt = performance.now();
  }
  if ('hue' in detail || detail.mode) sceneState.hue = detail.hue;
  dispatchEvent(new CustomEvent<SceneEvent>('rw:scene', { detail }));
}
