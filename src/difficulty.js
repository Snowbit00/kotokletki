// Логический решатель: решает поле теми же приёмами, что и человек,
// и по ним оценивает сложность. Используется генератором и подсказками.
//
// Ступени приёмов:
//   1 — очевидные: в комнате, строке или столбце осталась одна клетка;
//   2 — исключения: комната целиком в одной линии (и наоборот),
//       клетка, которая задевает обе оставшиеся клетки комнаты или линии;
//   3 — комбинации: 2–3 комнаты целиком в 2–3 линиях (и наоборот),
//       клетка, которая задевает все оставшиеся клетки комнаты или линии;
//   4 — цепочки: «если здесь кот, то где-то не останется места».

export const TIER_WEIGHT = [0, 1, 3, 8, 20];
export const MAX_TIER = 4;
const STEP_GUARD = 3000;

export class Logic {
  constructor(n, regions) {
    this.n = n;
    this.size = n * n;
    this.regions = regions;

    const rows = [];
    const cols = [];
    const regs = [];
    for (let i = 0; i < n; i++) {
      rows.push([]);
      cols.push([]);
      regs.push([]);
    }
    for (let i = 0; i < this.size; i++) {
      rows[(i / n) | 0].push(i);
      cols[i % n].push(i);
      regs[regions[i]].push(i);
    }
    // Номера домов: 0..n-1 — комнаты, n..2n-1 — строки, 2n..3n-1 — столбцы.
    this.houses = regs.concat(rows, cols);

    this.peers = [];
    this.peerSet = [];
    for (let i = 0; i < this.size; i++) {
      const set = new Uint8Array(this.size);
      const r = (i / n) | 0;
      const c = i % n;
      for (const j of rows[r]) set[j] = 1;
      for (const j of cols[c]) set[j] = 1;
      for (const j of regs[regions[i]]) set[j] = 1;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n) set[rr * n + cc] = 1;
        }
      }
      set[i] = 0;
      const list = [];
      for (let j = 0; j < this.size; j++) if (set[j]) list.push(j);
      this.peers.push(list);
      this.peerSet.push(set);
    }

    this.cand = new Uint8Array(this.size).fill(1);
    this.cat = new Uint8Array(this.size);
    this.done = new Uint8Array(3 * n);
    this.placed = 0;
  }

  clone() {
    const copy = Object.create(Logic.prototype);
    copy.n = this.n;
    copy.size = this.size;
    copy.regions = this.regions;
    copy.houses = this.houses;
    copy.peers = this.peers;
    copy.peerSet = this.peerSet;
    copy.cand = this.cand.slice();
    copy.cat = this.cat.slice();
    copy.done = this.done.slice();
    copy.placed = this.placed;
    return copy;
  }

  place(i) {
    const n = this.n;
    this.cat[i] = 1;
    this.cand[i] = 0;
    this.placed++;
    this.done[this.regions[i]] = 1;
    this.done[n + ((i / n) | 0)] = 1;
    this.done[2 * n + (i % n)] = 1;
    for (const j of this.peers[i]) this.cand[j] = 0;
  }

  candsOf(house) {
    const out = [];
    for (const i of this.houses[house]) if (this.cand[i]) out.push(i);
    return out;
  }

  // Ступень 1. Возвращает шаг, null или признак противоречия.
  single() {
    for (let h = 0; h < 3 * this.n; h++) {
      if (this.done[h]) continue;
      const cands = this.candsOf(h);
      if (cands.length === 0) return { contradiction: true };
      if (cands.length === 1) return { tier: 1, type: 'single', house: h, cell: cands[0] };
    }
    return null;
  }

  // Клетка-кандидат, которая задевает все оставшиеся клетки дома.
  attackAll(minCands, maxCands, tier) {
    for (let h = 0; h < 3 * this.n; h++) {
      if (this.done[h]) continue;
      const cands = this.candsOf(h);
      if (cands.length < minCands || cands.length > maxCands) continue;
      const elim = [];
      for (let x = 0; x < this.size; x++) {
        if (!this.cand[x]) continue;
        const set = this.peerSet[x];
        let all = true;
        for (const c of cands) {
          if (c === x || !set[c]) {
            all = false;
            break;
          }
        }
        if (all) elim.push(x);
      }
      if (elim.length) return { tier, type: 'attack', house: h, elim };
    }
    return null;
  }

  // k комнат целиком в k линиях или k линий целиком в k комнатах.
  lineSets(k, tier) {
    const n = this.n;
    for (let orient = 0; orient < 2; orient++) {
      const lineBase = orient === 0 ? n : 2 * n;
      const regLines = new Array(n).fill(0);
      const lineRegs = new Array(n).fill(0);
      for (let i = 0; i < this.size; i++) {
        if (!this.cand[i]) continue;
        const line = orient === 0 ? (i / n) | 0 : i % n;
        const g = this.regions[i];
        regLines[g] |= 1 << line;
        lineRegs[line] |= 1 << g;
      }
      const openLines = [];
      const openRegs = [];
      for (let x = 0; x < n; x++) {
        if (!this.done[lineBase + x]) openLines.push(x);
        if (!this.done[x]) openRegs.push(x);
      }

      for (const lineMask of subsets(openLines, k)) {
        let inside = 0;
        let count = 0;
        for (const g of openRegs) {
          if ((regLines[g] & ~lineMask) === 0) {
            inside |= 1 << g;
            count++;
          }
        }
        if (count !== k) continue;
        const elim = this.collect(orient, lineMask, true, inside, false);
        if (elim.length) return { tier, type: 'regionsInLines', orient, lineMask, regMask: inside, elim };
      }

      for (const regMask of subsets(openRegs, k)) {
        let lines = 0;
        let count = 0;
        for (const line of openLines) {
          if ((lineRegs[line] & ~regMask) === 0) {
            lines |= 1 << line;
            count++;
          }
        }
        if (count !== k) continue;
        const elim = this.collect(orient, lines, false, regMask, true);
        if (elim.length) return { tier, type: 'linesInRegions', orient, lineMask: lines, regMask, elim };
      }
    }
    return null;
  }

  // Кандидаты, у которых линия и комната попадают (или не попадают) в маски.
  collect(orient, lineMask, wantLine, regMask, wantReg) {
    const n = this.n;
    const out = [];
    for (let i = 0; i < this.size; i++) {
      if (!this.cand[i]) continue;
      const line = orient === 0 ? (i / n) | 0 : i % n;
      const inLine = (lineMask & (1 << line)) !== 0;
      const inReg = (regMask & (1 << this.regions[i])) !== 0;
      if (inLine === wantLine && inReg === wantReg) out.push(i);
    }
    return out;
  }

  // Ставит все очевидные клетки. false — получено противоречие.
  propagateSingles() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let h = 0; h < 3 * this.n; h++) {
        if (this.done[h]) continue;
        let count = 0;
        let last = -1;
        for (const i of this.houses[h]) {
          if (this.cand[i]) {
            count++;
            last = i;
            if (count > 1) break;
          }
        }
        if (count === 0) return false;
        if (count === 1) {
          this.place(last);
          changed = true;
        }
      }
    }
    return true;
  }

  // Ступень 4.
  chain() {
    for (let i = 0; i < this.size; i++) {
      if (!this.cand[i]) continue;
      const trial = this.clone();
      trial.place(i);
      if (!trial.propagateSingles()) return { tier: 4, type: 'chain', elim: [i] };
    }
    return null;
  }

  // Самый простой доступный шаг, не выше ступени maxTier.
  nextStep(maxTier = MAX_TIER) {
    const first = this.single();
    if (first) return first.contradiction ? null : first;
    if (maxTier < 2) return null;
    const second = this.lineSets(1, 2) || this.attackAll(2, 2, 2);
    if (second) return second;
    if (maxTier < 3) return null;
    const third = this.lineSets(2, 3) || this.lineSets(3, 3) || this.attackAll(3, this.size, 3);
    if (third) return third;
    if (maxTier < 4) return null;
    return this.chain();
  }

  apply(step) {
    if (step.type === 'single') {
      this.place(step.cell);
      return;
    }
    for (const i of step.elim) this.cand[i] = 0;
  }
}

// Все подмножества размера k (k = 1..3) в виде битовых масок.
function subsets(items, k) {
  const out = [];
  const len = items.length;
  if (k === 1) {
    for (let a = 0; a < len; a++) out.push(1 << items[a]);
  } else if (k === 2) {
    for (let a = 0; a < len; a++) {
      for (let b = a + 1; b < len; b++) out.push((1 << items[a]) | (1 << items[b]));
    }
  } else {
    for (let a = 0; a < len; a++) {
      for (let b = a + 1; b < len; b++) {
        for (let c = b + 1; c < len; c++) out.push((1 << items[a]) | (1 << items[b]) | (1 << items[c]));
      }
    }
  }
  return out;
}

// Оценка поля: решается ли логикой, какая старшая ступень нужна, сколько шагов.
export function rate(n, regions) {
  const logic = new Logic(n, regions);
  const counts = [0, 0, 0, 0, 0];
  let guard = 0;
  let solved = true;
  while (logic.placed < n) {
    const step = logic.nextStep();
    if (!step || ++guard > STEP_GUARD) {
      solved = false;
      break;
    }
    logic.apply(step);
    counts[step.tier]++;
  }
  let maxTier = 0;
  let score = 0;
  for (let t = 1; t <= MAX_TIER; t++) {
    if (counts[t] > 0) maxTier = t;
    score += counts[t] * TIER_WEIGHT[t];
  }
  return { solved, maxTier, score, counts };
}

// Подсказка: первая клетка с котом, которую можно вывести логикой из уже
// поставленных котов. Возвращает { cell, house } или null.
export function findHint(n, regions, catCells) {
  const logic = new Logic(n, regions);
  for (const i of catCells) logic.place(i);
  let guard = 0;
  while (logic.placed < n && guard++ < STEP_GUARD) {
    const step = logic.nextStep();
    if (!step) return null;
    if (step.type === 'single') return { cell: step.cell, house: step.house, tier: 1 };
    logic.apply(step);
  }
  return null;
}

// Заказ сложности (spec): n — размер поля, minTier..maxTier — допустимая старшая
// ступень, minHard — сколько шагов старшей ступени нужно как минимум.
// Ступени лестницы уровней. sizes — размеры поля, чередуются от уровня к уровню.
// Быстрый рост (12.11.2026, GEN_VERSION 2): обучение — только уровни 1–2,
// дальше сразу исключения, комбинации с 11-го, цепочки с 31-го.
export const STAGES = [
  { from: 1, sizes: [5], minTier: 1, maxTier: 1, minHard: 0 },
  { from: 3, sizes: [6], minTier: 2, maxTier: 2, minHard: 2 },
  { from: 11, sizes: [7], minTier: 3, maxTier: 3, minHard: 1 },
  { from: 31, sizes: [8], minTier: 4, maxTier: 4, minHard: 1 },
  { from: 71, sizes: [9], minTier: 4, maxTier: 4, minHard: 2 },
  { from: 131, sizes: [9, 10], minTier: 4, maxTier: 4, minHard: 3 },
  { from: 221, sizes: [10, 11], minTier: 4, maxTier: 4, minHard: 4 },
  { from: 401, sizes: [11, 12], minTier: 4, maxTier: 4, minHard: 5 },
];

// Сложности свободной игры: у каждой своя бесконечная череда уровней.
export const DIFFICULTIES = [
  { id: 'easy', sizes: [5, 6], minTier: 1, maxTier: 2, minHard: 0 },
  { id: 'medium', sizes: [7], minTier: 2, maxTier: 3, minHard: 0 },
  { id: 'hard', sizes: [8], minTier: 3, maxTier: 4, minHard: 0 },
  { id: 'expert', sizes: [9, 10], minTier: 4, maxTier: 4, minHard: 2 },
  { id: 'master', sizes: [11, 12], minTier: 4, maxTier: 4, minHard: 4 },
];

const INTRO_LEVELS = 1;
const SOFT_FLOOR_TIER = 2;
const BREATHER_EVERY = 10;
const TIER_PENALTY = 100;
const HARDER_PENALTY = 50;
const HARD_STEP_PENALTY = 10;

export function stageIndex(level) {
  let index = 0;
  for (let s = 0; s < STAGES.length; s++) if (level >= STAGES[s].from) index = s;
  return index;
}

// Кривая сложности: размер поля и допустимые ступени для уровня K.
export function levelSpec(level) {
  const index = stageIndex(level);
  const stage = STAGES[index];
  let { minTier, maxTier, minHard } = stage;
  const intro = index > 0 && level - stage.from < INTRO_LEVELS;
  const breather = level % BREATHER_EVERY === 0;
  // Передышка и знакомство со ступенью: меньший размер и приёмы на ступень проще.
  const isSoft = intro || breather;
  const n = isSoft ? stage.sizes[0] : stage.sizes[level % stage.sizes.length];
  if (isSoft) {
    // После обучения передышка не опускается до «очевидных клеток»:
    // хотя бы один шаг на исключение остаётся, иначе уровень решается в одно касание.
    const floor = index > 0 ? SOFT_FLOOR_TIER : 1;
    minTier = Math.max(floor, minTier - 1);
    maxTier = Math.max(floor, maxTier - 1);
    minHard = 0;
  }
  return { n, minTier, maxTier, minHard, breather, intro, stage: index };
}

// Свободная игра: уровень level сложности id.
export function freeSpec(id, level) {
  const difficulty = DIFFICULTIES.find((item) => item.id === id) || DIFFICULTIES[0];
  const n = difficulty.sizes[(level - 1) % difficulty.sizes.length];
  return {
    n,
    minTier: difficulty.minTier,
    maxTier: difficulty.maxTier,
    minHard: difficulty.minHard,
    breather: false,
    intro: false,
    stage: -1,
  };
}

// Задача дня: размер и ступень по дню недели (настройка в content.json).
// byWeekday — массив из 7 записей, первая — понедельник.
export function dailySpec(dateStr, byWeekday) {
  const parts = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  const entry = byWeekday[(weekday + 6) % 7];
  const tier = Math.min(MAX_TIER, Math.max(1, entry.tier));
  return { n: entry.size, minTier: tier, maxTier: tier, minHard: 0, breather: false, intro: false, stage: -1 };
}

// Насколько оценка поля далека от заказа. 0 — поле подходит.
export function specDistance(rating, spec) {
  let d = 0;
  if (rating.maxTier < spec.minTier) d += (spec.minTier - rating.maxTier) * TIER_PENALTY;
  if (rating.maxTier > spec.maxTier) d += (rating.maxTier - spec.maxTier) * TIER_PENALTY + HARDER_PENALTY;
  const hard = rating.counts[spec.minTier] || 0;
  if (hard < spec.minHard) d += (spec.minHard - hard) * HARD_STEP_PENALTY;
  return d;
}
