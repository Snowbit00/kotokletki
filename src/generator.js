// Генератор полей: расстановка котов → рост комнат с сохранением единственного
// решения → оценка сложности → усложнение до заказанной ступени → подбор под
// кривую уровней.
//
// ВАЖНО. Уровень №K и задача дня у всех игроков должны совпадать, поэтому:
//   • случайность берётся только из makeRng(seed);
//   • нет отсечек по времени, только по числу попыток;
//   • любое изменение этого файла, difficulty.js, solver.js или rng.js,
//     которое меняет результат, требует увеличить GEN_VERSION.

import { makeRng } from './rng.js';
import { findSolutions } from './solver.js';
import { rate, levelSpec, freeSpec, specDistance } from './difficulty.js';

// 2 — быстрый рост сложности лестницы (12.11.2026). Игра ещё не выпущена,
// поэтому смена уровней никому не мешает.
export const GEN_VERSION = 2;

const MAX_ATTEMPTS = 100;
const MAX_REPAIRS = 16;
const MAX_HARDEN_STEPS = 300;
const PALETTE_SIZE = 12;

// Веса роста комнат: чем сильнее разброс, тем больше маленьких комнат и проще поле.
const GROWTH_WEIGHTS = {
  1: [1, 1, 2, 6, 12],
  2: [1, 2, 3, 6],
  3: [2, 3, 4, 5],
};
const DEFAULT_WEIGHTS = [2, 3, 4, 5];

function neighbors4(n, i) {
  const out = [];
  const r = (i / n) | 0;
  const c = i % n;
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

// Случайная расстановка: по одному коту в строке и столбце, соседние строки
// различаются минимум на два столбца (значит, коты не касаются и по диагонали).
function randomSolution(n, rng) {
  const cols = new Array(n).fill(-1);
  const used = new Array(n).fill(false);
  function rec(r) {
    if (r === n) return true;
    const order = [];
    for (let c = 0; c < n; c++) order.push(c);
    rng.shuffle(order);
    for (const c of order) {
      if (used[c]) continue;
      if (r > 0 && Math.abs(c - cols[r - 1]) < 2) continue;
      cols[r] = c;
      used[c] = true;
      if (rec(r + 1)) return true;
      used[c] = false;
    }
    return false;
  }
  rec(0);
  return cols;
}

// Свободные клетки рядом с каждой комнатой. banned[cell * n + g] = 1 —
// эту клетку комнате g отдавать нельзя.
function collectFrontier(n, reg, banned, isCompact) {
  const frontier = [];
  for (let g = 0; g < n; g++) frontier.push([]);
  for (let i = 0; i < n * n; i++) {
    if (reg[i] !== -1) continue;
    for (const j of neighbors4(n, i)) {
      const g = reg[j];
      if (g === -1 || (banned && banned[i * n + g])) continue;
      const list = frontier[g];
      // В компактном режиме клетка с несколькими соседями из комнаты
      // попадает в список несколько раз и выбирается чаще.
      if (isCompact || list[list.length - 1] !== i) list.push(i);
    }
  }
  return frontier;
}

// Выбор комнаты с учётом весов. -1 — расти некуда.
function pickRegion(frontier, weights, rng) {
  let total = 0;
  for (let g = 0; g < frontier.length; g++) if (frontier[g].length) total += weights[g];
  if (total === 0) return -1;
  let x = rng.int(total);
  for (let g = 0; g < frontier.length; g++) {
    if (!frontier[g].length) continue;
    if (x < weights[g]) return g;
    x -= weights[g];
  }
  return -1;
}

// Комнаты растут от клеток с котами. Клетка отдаётся комнате, только если после
// этого не появляется второго решения: новое решение обязано ставить кота именно
// в добавленную клетку, поэтому достаточно поискать решение с котом в ней.
// Возвращает число клеток, которые пристроить без второго решения не удалось.
function growRegions(n, reg, weights, rng, isCompact) {
  const banned = new Uint8Array(n * n * n);
  let left = 0;
  for (let i = 0; i < n * n; i++) if (reg[i] === -1) left++;
  while (left > 0) {
    const frontier = collectFrontier(n, reg, banned, isCompact);
    const g = pickRegion(frontier, weights, rng);
    if (g < 0) break;
    const cell = rng.pick(frontier[g]);
    reg[cell] = g;
    if (findSolutions(n, reg, 1, cell).length > 0) {
      reg[cell] = -1;
      banned[cell * n + g] = 1;
    } else {
      left--;
    }
  }
  return left;
}

// Оставшиеся клетки раздаются без проверки (единственность потом чинится).
function fillRest(n, reg, weights, rng) {
  for (;;) {
    const frontier = collectFrontier(n, reg, null, true);
    const g = pickRegion(frontier, weights, rng);
    if (g < 0) return;
    reg[rng.pick(frontier[g])] = g;
  }
}

function isConnectedWithout(n, reg, g, removed) {
  const size = n * n;
  let start = -1;
  let total = 0;
  for (let i = 0; i < size; i++) {
    if (reg[i] === g && i !== removed) {
      total++;
      if (start < 0) start = i;
    }
  }
  if (total === 0) return false;
  const seen = new Uint8Array(size);
  const stack = [start];
  seen[start] = 1;
  let count = 0;
  while (stack.length) {
    const i = stack.pop();
    count++;
    for (const j of neighbors4(n, i)) {
      if (!seen[j] && reg[j] === g && j !== removed) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return count === total;
}

function isSame(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Починка: пока решений больше одного, клетка с котом из лишнего решения
// передаётся соседней комнате. В той комнате у лишнего решения становится два
// кота, и оно перестаёт подходить. Задуманное решение при этом не страдает.
function makeUnique(n, reg, solution, rng) {
  for (let iteration = 0; iteration <= MAX_REPAIRS; iteration++) {
    const sols = findSolutions(n, reg, 2);
    if (sols.length === 1) return true;
    if (sols.length === 0) return false;
    const alt = isSame(sols[0], solution) ? sols[1] : sols[0];
    const moves = [];
    for (let r = 0; r < n; r++) {
      if (alt[r] === solution[r]) continue;
      const cell = r * n + alt[r];
      const from = reg[cell];
      if (!isConnectedWithout(n, reg, from, cell)) continue;
      const targets = [];
      for (const j of neighbors4(n, cell)) {
        const to = reg[j];
        if (to !== from && targets.indexOf(to) < 0) targets.push(to);
      }
      for (const to of targets) moves.push({ cell, to });
    }
    if (!moves.length) return false;
    const move = rng.pick(moves);
    reg[move.cell] = move.to;
  }
  return false;
}

// Номера комнат — по порядку первого появления при чтении поля слева направо,
// чтобы номер (и цвет) комнаты не выдавал, в какой строке её кот.
function relabel(n, reg) {
  const map = new Array(n).fill(-1);
  const out = new Array(n * n);
  let next = 0;
  for (let i = 0; i < n * n; i++) {
    const g = reg[i];
    if (map[g] < 0) map[g] = next++;
    out[i] = map[g];
  }
  return out;
}

function pickColors(n, rng) {
  const all = [];
  for (let i = 0; i < PALETTE_SIZE; i++) all.push(i);
  return rng.shuffle(all).slice(0, n);
}

// Не хватает ли полю сложности до заказа.
function needsHarder(rating, spec) {
  if (rating.maxTier < spec.minTier) return true;
  return rating.maxTier === spec.minTier && (rating.counts[spec.minTier] || 0) < spec.minHard;
}

// Клетки на границе комнат, которые можно передать соседней комнате.
// Ход кодируется числом cell * n + комната-получатель. Клетки с котами не трогаются.
function boundaryMoves(n, reg, solution) {
  const moves = [];
  for (let i = 0; i < n * n; i++) {
    if (solution[(i / n) | 0] === i % n) continue;
    const from = reg[i];
    let seen = 0;
    for (const j of neighbors4(n, i)) {
      const to = reg[j];
      if (to === from || seen & (1 << to)) continue;
      seen |= 1 << to;
      moves.push(i * n + to);
    }
  }
  return moves;
}

// Усложнение: пограничные клетки по одной переходят в соседние комнаты, пока
// поле не дорастёт до заказанной ступени. Ход принимается, если решение
// осталось единственным (новое решение обязано ставить кота в переданную
// клетку — это и проверяется), поле решается логикой и не стало проще.
function harden(n, reg, solution, rng, spec, rating) {
  let best = rating;
  for (let step = 0; step < MAX_HARDEN_STEPS && needsHarder(best, spec); step++) {
    const moves = boundaryMoves(n, reg, solution);
    if (!moves.length) return;
    const move = rng.pick(moves);
    const cell = (move / n) | 0;
    const from = reg[cell];
    if (!isConnectedWithout(n, reg, from, cell)) continue;
    reg[cell] = move % n;
    const next = findSolutions(n, reg, 1, cell).length === 0 ? rate(n, reg) : null;
    if (!next || !next.solved || next.maxTier > spec.maxTier || next.score < best.score) {
      reg[cell] = from;
      continue;
    }
    best = next;
  }
}

// Одна попытка. Возвращает поле или { failed: 'unique' | 'logic' }.
export function buildCandidate(seed, attempt, spec) {
  const n = spec.n;
  const rng = makeRng(seed + ':' + attempt);
  const solution = randomSolution(n, rng);
  const weightPool = GROWTH_WEIGHTS[spec.maxTier] || DEFAULT_WEIGHTS;
  const isCompact = spec.minHard === 0;

  const reg = new Array(n * n).fill(-1);
  const weights = [];
  for (let r = 0; r < n; r++) {
    reg[r * n + solution[r]] = r;
    weights.push(rng.pick(weightPool));
  }
  const stuck = growRegions(n, reg, weights, rng, isCompact);
  if (stuck > 0) {
    fillRest(n, reg, weights, rng);
    if (!makeUnique(n, reg, solution, rng)) return { failed: 'unique' };
  }

  const draft = rate(n, reg);
  if (!draft.solved) return { failed: 'logic' };
  if (needsHarder(draft, spec)) harden(n, reg, solution, rng, spec, draft);

  // Оценка считается заново по окончательным номерам комнат: число шагов
  // зависит от порядка обхода, а именно эти номера увидит игра.
  const regions = relabel(n, reg);
  const rating = rate(n, regions);
  if (!rating.solved) return { failed: 'logic' };
  return {
    n,
    regions,
    solution,
    colors: pickColors(n, rng),
    tier: rating.maxTier,
    score: rating.score,
    counts: rating.counts,
    attempt,
    dist: specDistance(rating, spec),
  };
}

// Строит поле под заказанную сложность. Берётся первая подходящая попытка;
// если за MAX_ATTEMPTS попыток точного попадания нет — ближайшая по оценке.
export function buildBoard(seed, spec) {
  let best = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = buildCandidate(seed, attempt, spec);
    if (candidate.failed) continue;
    if (candidate.dist === 0) return finish(candidate, false);
    if (!best || candidate.dist < best.dist) best = candidate;
  }
  if (best) return finish(best, true);
  throw new Error('Не удалось построить поле: ' + seed);
}

function finish(candidate, isFallback) {
  const { dist, ...board } = candidate;
  return { ...board, fallback: isFallback };
}

export function makeLevel(level) {
  return buildBoard('l:' + GEN_VERSION + ':' + level, levelSpec(level));
}

export function makeDaily(dateStr, spec) {
  return buildBoard('d:' + GEN_VERSION + ':' + dateStr, spec);
}

// Свободная игра: уровень level сложности difficultyId.
export function makeFree(difficultyId, level) {
  return buildBoard('f:' + GEN_VERSION + ':' + difficultyId + ':' + level, freeSpec(difficultyId, level));
}
