// Генератор случайных чисел с seed.
// Только целочисленная арифметика: один и тот же seed даёт одно и то же поле
// на любом устройстве и в любом браузере. Math.random здесь не используется.

function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function makeRng(seedStr) {
  const seed = hashString(String(seedStr));
  let a = seed() | 0;
  let b = seed() | 0;
  let c = seed() | 0;
  let d = seed() | 0;

  // sfc32: возвращает целое 0..2^32-1
  function next() {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  }
  for (let i = 0; i < 12; i++) next();

  const rng = {
    next,
    // Целое 0..n-1 без перекоса (лишние значения отбрасываются).
    int(n) {
      const limit = 4294967296 - (4294967296 % n);
      let x = next();
      while (x >= limit) x = next();
      return x % n;
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },
    pick(arr) {
      return arr[rng.int(arr.length)];
    },
  };
  return rng;
}
