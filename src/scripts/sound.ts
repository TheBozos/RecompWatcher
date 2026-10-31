// Small synthesized menu sounds, off until the visitor turns them on.

import { getSettings, setSettings } from './settings';

type Cue = 'move' | 'confirm' | 'back';

let ctx: AudioContext | undefined;

export const soundOn = () => getSettings().sound;

export function setSound(on: boolean) {
  setSettings({ sound: on });
  if (on) play('confirm');
}

function tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const c = ctx!;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  amp.gain.setValueAtTime(0, c.currentTime + start);
  amp.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

export function play(cue: Cue) {
  if (!soundOn()) return;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  if (cue === 'move') tone(1320, 0, 0.07, 0.05, 'triangle');
  if (cue === 'confirm') {
    tone(880, 0, 0.12, 0.06);
    tone(1760, 0.05, 0.22, 0.05);
  }
  if (cue === 'back') {
    tone(990, 0, 0.08, 0.05, 'triangle');
    tone(660, 0.06, 0.14, 0.05, 'triangle');
  }
}
