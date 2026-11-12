// Короткие звуки игры синтезируются через WebAudio.
// «Мяу» при посадке кота — записи настоящих кошек (meow.js, assets/sounds), у каждого скина свой голос.

import { playMeow, loadMeows } from './meow.js';

const MEOW_VARIATION = 0.04; // ± разброс высоты, чтобы подряд «мяу» звучали чуть по-разному
const CUT_S = 0.04;

let context = null;
let isEnabled = true;
let isMeowEnabled = true;
let isMuted = false;
let lastMeow = null;

function getContext() {
  if (!context) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    // Записи «мяу» грузятся сразу, с первым звуком игры, — к посадке кота они готовы.
    loadMeows(context);
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

function canPlay() {
  return isEnabled && !isMuted && !document.hidden;
}

// Один короткий тон: частота плавно меняется от from к to.
function tone(from, to, duration, options = {}) {
  if (!canPlay()) return;
  const ctx = getContext();
  if (!ctx) return;
  const start = ctx.currentTime + (options.delay || 0);
  const volume = options.volume || 0.12;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type || 'sine';
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

// «Мяу» голосом voice (из voiceOf). Предыдущее «мяу» обрывается, чтобы при быстрой
// расстановке котов звуки не накладывались.
function meow(voice) {
  if (!canPlay() || !voice) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (lastMeow) {
    lastMeow.gain.cancelScheduledValues(now);
    lastMeow.gain.setTargetAtTime(0.0001, now, CUT_S / 3);
  }
  const variation = 1 + (Math.random() * 2 - 1) * MEOW_VARIATION;
  const out = playMeow(ctx, voice, now + 0.01, ctx.destination, variation, Math.random);
  // Запись ещё не загрузилась (или не загрузилась вовсе) — короткий звук вместо «мяу».
  if (out) lastMeow = out;
  else sfx.place();
}

export const sfx = {
  place() {
    tone(520, 880, 0.13, { type: 'triangle', volume: 0.16 });
    tone(880, 1040, 0.09, { delay: 0.09, volume: 0.08 });
  },
  // Кот сел в клетку: «мяу» его голосом, а если «мяу» выключено — короткий звук.
  catSits(voice) {
    if (isMeowEnabled && voice) meow(voice);
    else sfx.place();
  },
  // Прослушать голос (примерка в магазине) — даже если «мяу» на поле выключено.
  meow(voice) {
    meow(voice);
  },
  mark() {
    tone(420, 360, 0.05, { volume: 0.06 });
  },
  wrong() {
    tone(240, 150, 0.22, { type: 'sawtooth', volume: 0.07 });
  },
  hint() {
    tone(880, 1320, 0.18, { volume: 0.1 });
  },
  tap() {
    tone(600, 640, 0.04, { volume: 0.05 });
  },
  // Звезда оценки: k — номер звезды (0, 1, 2), каждая чуть выше.
  star(k = 0) {
    const base = 880 * (1 + k * 0.19);
    tone(base, base * 1.5, 0.16, { type: 'triangle', volume: 0.12 });
    tone(base * 2, base * 2, 0.1, { delay: 0.06, volume: 0.05 });
  },
  coin() {
    tone(1200, 1250, 0.07, { volume: 0.08 });
    tone(1600, 1650, 0.1, { delay: 0.07, volume: 0.08 });
  },
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, index) => tone(freq, freq, 0.22, { type: 'triangle', delay: index * 0.11, volume: 0.14 }));
  },
};

export function setSoundEnabled(value) {
  isEnabled = value !== false;
}

export function setMeowEnabled(value) {
  isMeowEnabled = value !== false;
}

// Площадки требуют тишины на время рекламы.
export function setMuted(value) {
  isMuted = value === true;
}
