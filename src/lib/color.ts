// Chart colours: each project's hue at one perceived lightness (OKLCH), so
// every chart line reads equally bright on the dark panels. Lightness 0.66 /
// chroma 0.15 passes the dataviz validator's dark band and 3:1 contrast.

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** The OKLCH hue of an sRGB colour. */
function oklchHue([r, g, b]: [number, number, number]) {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
}

export const CHART_L = 0.66;
export const CHART_C = 0.15;

/** A project's chart colour from its 0-360 HSL hue. */
export function chartColor(hue: number) {
  return `oklch(${CHART_L} ${CHART_C} ${oklchHue(hslToRgb(hue, 0.9, 0.6)).toFixed(1)})`;
}
