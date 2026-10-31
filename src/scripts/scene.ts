// The PS2-style backdrop: a field of translucent towers under blue fog, with
// specks of light drifting upward. It lives in a persisted canvas, so it keeps
// running across page navigations; pages steer it with `rw:scene` events.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  FogExp2,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three';

import { sceneState, type SceneEvent, type SceneMode } from './scene-events';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function init(host: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x01030a);
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.fog = new FogExp2(0x02061a, 0.045);
  const camera = new PerspectiveCamera(50, 1, 0.1, 120);

  // Towers ------------------------------------------------------------------
  const GRID = 34;
  const GAP = 1.6;
  const count = GRID * GRID;
  const towerMat = new MeshPhongMaterial({
    color: 0x6f8dff,
    emissive: 0x0a1a55,
    specular: 0x9fc4ff,
    shininess: 60,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const towers = new InstancedMesh(new BoxGeometry(0.62, 1, 0.62), towerMat, count);
  scene.add(towers);

  const heights = new Float32Array(count);
  const delays = new Float32Array(count);
  const pos: [number, number][] = [];
  const noise = (x: number, z: number) =>
    Math.sin(x * 0.35) * Math.cos(z * 0.3) + Math.sin((x + z) * 0.17) * 0.8 + Math.sin(x * 1.3 + z * 0.9) * 0.25;
  for (let i = 0; i < count; i++) {
    const gx = (i % GRID) - GRID / 2;
    const gz = Math.floor(i / GRID) - GRID / 2;
    const x = gx * GAP;
    const z = gz * GAP;
    pos.push([x, z]);
    const d = Math.hypot(x, z);
    // A clearing in the middle keeps the towers out from behind the UI.
    const clearing = MathUtils.smoothstep(d, 2, 16);
    heights[i] = Math.max(0.12, (1.3 + noise(gx, gz) * 1.1 + Math.random() * 0.9) * (0.2 + clearing * 1.1));
    delays[i] = d * 0.05 + Math.random() * 0.4;
  }

  // Drifting specks -----------------------------------------------------------
  const SPECKS = 420;
  const speckGeo = new BufferGeometry();
  const speckPos = new Float32Array(SPECKS * 3);
  for (let i = 0; i < SPECKS; i++) {
    speckPos[i * 3] = (Math.random() - 0.5) * GRID * GAP;
    speckPos[i * 3 + 1] = Math.random() * 14;
    speckPos[i * 3 + 2] = (Math.random() - 0.5) * GRID * GAP;
  }
  speckGeo.setAttribute('position', new BufferAttribute(speckPos, 3));
  const specks = new Points(
    speckGeo,
    new PointsMaterial({
      color: 0xbcd4ff,
      size: 0.09,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(specks);

  // Floor glow
  const floor = new Mesh(
    new CircleGeometry(GRID * GAP * 0.7, 64),
    new MeshBasicMaterial({ color: 0x0b1d6b, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Lights
  scene.add(new HemisphereLight(0x8fb0ff, 0x02040c, 0.9));
  const glow = new PointLight(0x5c8cff, 60, 40, 1.6);
  glow.position.set(0, 6, 0);
  scene.add(glow);

  // State -----------------------------------------------------------------------
  let mode: SceneMode = sceneState.mode ?? 'menu';
  let modeAt = sceneState.modeAt;
  const BASE = new Color(0x6f8dff);
  const hueNow = BASE.clone();
  const hueTarget = BASE.clone();
  // Tint toward the selected item's hue, keeping the PS2 blue underneath.
  const tint = (hue?: number) =>
    hue === undefined ? hueTarget.copy(BASE) : hueTarget.setHSL(hue / 360, 0.85, 0.6);
  tint(sceneState.hue);
  const tmpColor = new Color();
  const dummy = new Object3D();

  function resize() {
    const w = host.clientWidth || innerWidth;
    const h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  function frame(now: number) {
    const t = now / 1000;
    const sinceMode = (now - modeAt) / 1000;

    // Rising towers during boot; a gentle swell otherwise.
    const rise = mode === 'boot' ? sinceMode * 0.9 : 99;
    for (let i = 0; i < count; i++) {
      const grow = reduceMotion ? 1 : MathUtils.smootherstep(rise - delays[i], 0, 1);
      const breathe = reduceMotion ? 1 : 1 + Math.sin(t * 0.6 + pos[i][0] * 0.4 + pos[i][1] * 0.3) * 0.08;
      const h = Math.max(0.001, heights[i] * grow * breathe);
      dummy.position.set(pos[i][0], h / 2, pos[i][1]);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      towers.setMatrixAt(i, dummy.matrix);
    }
    towers.instanceMatrix.needsUpdate = true;

    if (!reduceMotion) {
      const p = speckGeo.attributes.position as BufferAttribute;
      for (let i = 0; i < SPECKS; i++) {
        let y = p.getY(i) + 0.006 + (i % 7) * 0.0012;
        if (y > 14) y = 0;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    // Camera: the boot sweeps down from high above, the menu orbits slowly,
    // content pages sit low and dim so text stays readable.
    const orbit = reduceMotion ? 0.6 : t * 0.035;
    let radius = 14;
    let height = 9;
    if (mode === 'boot') {
      const k = MathUtils.smootherstep(sinceMode, 0, 4.5);
      radius = MathUtils.lerp(4, 14, k);
      height = MathUtils.lerp(22, 9, k);
    } else if (mode === 'page') {
      radius = 16;
      height = 6;
    }
    camera.position.set(Math.cos(orbit) * radius, height, Math.sin(orbit) * radius);
    camera.lookAt(0, mode === 'page' ? 2 : 0, 0);

    hueNow.lerp(hueTarget, 0.04);
    // Towers stay PS2-blue; the light and floor carry the selected hue.
    towerMat.color.copy(tmpColor.copy(BASE).lerp(hueNow, 0.25));
    towerMat.emissive.copy(tmpColor.copy(hueNow).multiplyScalar(0.12));
    glow.color.copy(hueNow);
    (floor.material as MeshBasicMaterial).color.copy(tmpColor.copy(hueNow).multiplyScalar(0.18));
    glow.position.set(Math.cos(t * 0.3) * 4, 6, Math.sin(t * 0.3) * 4);

    renderer.render(scene, camera);
  }

  if (reduceMotion) {
    frame(performance.now());
  } else {
    renderer.setAnimationLoop(frame);
  }

  addEventListener('rw:scene', (e) => {
    const { mode: m, hue } = (e as CustomEvent<SceneEvent>).detail;
    if (m && m !== mode) {
      mode = m;
      modeAt = performance.now();
    }
    if (hue !== undefined || (m && m !== 'boot')) tint(hue);
    if (reduceMotion) frame(performance.now());
  });
}

const host = document.getElementById('scene');
if (host && !host.dataset.ready) {
  host.dataset.ready = '1';
  try {
    init(host);
  } catch {
    // No WebGL: the CSS gradient behind the canvas is the fallback.
  }
}
