// Кошачье «Мяу» — запись настоящей кошки.
//
// Запись: «Cat Purr & Meow» (Kerzoven), OpenGameArt, лицензия CC0 (можно в коммерческой
//   игре, без указания автора). Отрезок нарезан и очищен от шума заранее, лежит в
//   assets/sounds/ (как — см. README, раздел «Голоса котиков»).
// Все голоса — одна живая протяжная запись (meow_long, Kerzoven). Голос скина — скорость
// её звучания: быстрее — выше и тоньше, медленнее — ниже и басовитее; у мурлыки в начале
// мурчание, у сонного — мягкий приглушённый тембр. Каждое «мяу» чуть отличается по высоте.
// Голос задаётся в content.json → cats → voice: имя голоса или { "preset": имя, "rate": множитель }.

const SOUND_DIR = new URL('../assets/sounds/', import.meta.url);

// Записи и их громкость (выровнена по пику после нарезки: около 0,36 в игре).
const CLIPS = {
  long: { file: 'meow_long.wav', volume: 1 },
};

// Голоса: запись, скорость (1 — как записано, длина 1,26 с), громкость;
// purr — доля длины с мурчанием в начале; soft — частота, выше которой звук приглушается.
export const VOICES = {
  classic: { clip: 'long', rate: 1.12, volume: 1 },
  kitten: { clip: 'long', rate: 1.45, volume: 0.95 },
  girl: { clip: 'long', rate: 1.28, volume: 1 },
  long: { clip: 'long', rate: 1, volume: 1 },
  deep: { clip: 'long', rate: 0.82, volume: 1 },
  trill: { clip: 'long', rate: 1.04, volume: 1, purr: 0.3 },
  squeak: { clip: 'long', rate: 1.62, volume: 0.9 },
  royal: { clip: 'long', rate: 0.9, volume: 1 },
  sleepy: { clip: 'long', rate: 0.92, volume: 0.9, soft: 2200 },
};

export const DEFAULT_VOICE = 'classic';

const RATE_LIMITS = [0.6, 1.6]; // множитель скорости скина (content.json)
const FINAL_RATE_LIMITS = [0.6, 1.9];
const PURR_HZ = 26;
const LEVEL = 0.4; // общая громкость: пик около 0,36, как у прочих звуков игры
const RATE_SPREAD = 0.04; // разброс высоты каждого «мяу»

const buffers = new WeakMap(); // контекст → Map(запись → AudioBuffer)
const files = new Map(); // файл → Promise с его байтами (скачивается один раз)
const loading = new WeakMap(); // контекст → Promise загрузки

function clamp(value, [min, max]) {
  return Math.min(max, Math.max(min, value));
}

// Голос скина: строка с именем голоса или объект { preset, rate }.
export function voiceOf(cat) {
  const raw = cat && cat.voice;
  const name = typeof raw === 'string' ? raw : raw && typeof raw.preset === 'string' ? raw.preset : DEFAULT_VOICE;
  const known = VOICES[name] ? name : DEFAULT_VOICE;
  const extra = raw && typeof raw === 'object' && Number.isFinite(raw.rate) ? clamp(raw.rate, RATE_LIMITS) : 1;
  const base = VOICES[known];
  return { ...base, name: known, rate: clamp(base.rate * extra, FINAL_RATE_LIMITS) };
}

// Длительность записи голоса, с (для проверок).
export function clipDuration(ctx, voice) {
  const map = buffers.get(ctx);
  const buffer = map && map.get(voice.clip);
  return buffer ? buffer.duration / voice.rate : 0;
}

function decode(ctx, data) {
  // Старый Safari понимает только вариант с функциями обратного вызова.
  return new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
}

function fileBytes(file) {
  if (!files.has(file)) {
    const job = fetch(new URL(file, SOUND_DIR)).then((response) => {
      if (!response.ok) throw new Error(file + ': ' + response.status);
      return response.arrayBuffer();
    });
    // Неудачную загрузку не запоминаем: в следующий раз попробуем снова.
    job.catch(() => files.delete(file));
    files.set(file, job);
  }
  return files.get(file);
}

// Загружает все записи для контекста ctx (один раз). Ошибка одной записи не мешает другим:
// для неё вместо «мяу» прозвучит обычный короткий звук.
export function loadMeows(ctx) {
  if (!loading.has(ctx)) {
    const map = new Map();
    buffers.set(ctx, map);
    const jobs = Object.keys(CLIPS).map(async (id) => {
      const bytes = await fileBytes(CLIPS[id].file);
      // decodeAudioData забирает буфер себе, поэтому каждому контексту — своя копия.
      map.set(id, await decode(ctx, bytes.slice(0)));
    });
    loading.set(ctx, Promise.allSettled(jobs));
  }
  return loading.get(ctx);
}

// Играет «Мяу» в контексте ctx со времени start в destination.
// variation — сдвиг высоты (1 — без сдвига); random — функция вида Math.random для
// небольшого разброса высоты (без неё звук всегда одинаковый — так его можно замерить).
// Возвращает узел громкости (по нему можно оборвать звук) или null, если запись ещё
// не загружена.
export function playMeow(ctx, voice, start, destination, variation = 1, random = null) {
  const map = buffers.get(ctx);
  const buffer = map && map.get(voice.clip);
  if (!buffer) return null;
  const spread = random ? 1 + (random() * 2 - 1) * RATE_SPREAD : 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = voice.rate * variation * spread;
  const out = ctx.createGain();
  out.gain.value = LEVEL * CLIPS[voice.clip].volume * (voice.volume || 1);
  let last = source;
  // Сонный голос: верхние частоты приглушены.
  if (voice.soft > 0) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = voice.soft;
    filter.Q.value = 0.7;
    last.connect(filter);
    last = filter;
  }
  // Мурлыка: в начале громкость дрожит с частотой ~26 Гц — «мррр-мяу».
  if (voice.purr > 0) {
    const length = buffer.duration / source.playbackRate.value;
    const tremolo = ctx.createGain();
    tremolo.gain.setValueAtTime(0.45, start);
    tremolo.gain.linearRampToValueAtTime(1, start + length * voice.purr);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = PURR_HZ;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0.55, start);
    depth.gain.linearRampToValueAtTime(0, start + length * voice.purr);
    lfo.connect(depth);
    depth.connect(tremolo.gain);
    lfo.start(start);
    lfo.stop(start + length * voice.purr + 0.05);
    last.connect(tremolo);
    last = tremolo;
  }
  last.connect(out);
  out.connect(destination);
  source.start(start);
  return out;
}
