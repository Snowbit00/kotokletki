// Решатель перебором с отсечениями.
// Поле: n — размер, regions[r * n + c] — номер комнаты клетки (0..n-1).
// Клетка с номером -1 ещё не отдана ни одной комнате, кота на неё ставить нельзя
// (так генератор проверяет недостроенное поле).
// Решение — массив длины n: solution[r] = столбец кота в строке r.
//
// Для каждой строки хранится битовая маска столбцов, куда ещё можно поставить
// кота. На каждом шаге берётся строка с наименьшим числом вариантов; ветка
// бросается, как только у строки или комнаты не остаётся ни одной клетки.

function popcount(value) {
  let x = value - ((value >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  return Math.imul((x + (x >> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

// Возвращает до limit решений. Для проверки единственности достаточно limit = 2.
// forcedCell — клетка, в которой кот обязан стоять (или -1).
export function findSolutions(n, regions, limit = 2, forcedCell = -1) {
  const found = [];
  const cols = new Array(n).fill(-1);

  // regRow[g * n + r] — столбцы строки r, принадлежащие комнате g.
  const regRow = new Int32Array(n * n);
  const levels = [];
  for (let d = 0; d <= n; d++) levels.push(new Int32Array(n));
  for (let i = 0; i < n * n; i++) {
    const g = regions[i];
    if (g < 0) continue;
    const r = (i / n) | 0;
    regRow[g * n + r] |= 1 << (i % n);
    levels[0][r] |= 1 << (i % n);
  }

  // Ставит кота в (r, c): записывает в next столбцы, оставшиеся у других строк.
  // rowMask и regMask — уже занятые строки и комнаты, включая эту клетку.
  // false — у какой-то строки или комнаты не осталось места.
  function apply(cur, next, r, c, rowMask, regMask) {
    const colBit = 1 << c;
    const notNear = ~((colBit << 1) | colBit | (colBit >> 1));
    const base = regions[r * n + c] * n;
    for (let rr = 0; rr < n; rr++) {
      if (rowMask & (1 << rr)) {
        next[rr] = 0;
        continue;
      }
      let mask = cur[rr] & ~colBit & ~regRow[base + rr];
      if (rr === r - 1 || rr === r + 1) mask &= notNear;
      if (mask === 0) return false;
      next[rr] = mask;
    }
    for (let g = 0; g < n; g++) {
      if (regMask & (1 << g)) continue;
      const offset = g * n;
      let hasCell = false;
      for (let rr = 0; rr < n; rr++) {
        if (next[rr] & regRow[offset + rr]) {
          hasCell = true;
          break;
        }
      }
      if (!hasCell) return false;
    }
    return true;
  }

  function rec(depth, rowMask, regMask) {
    if (depth === n) {
      found.push(cols.slice());
      return found.length >= limit;
    }
    const cur = levels[depth];
    let row = -1;
    let fewest = n + 1;
    for (let r = 0; r < n; r++) {
      if (rowMask & (1 << r)) continue;
      const count = popcount(cur[r]);
      if (count < fewest) {
        fewest = count;
        row = r;
        if (count <= 1) break;
      }
    }
    const nextRows = rowMask | (1 << row);
    let options = cur[row];
    while (options) {
      const bit = options & -options;
      options ^= bit;
      const c = 31 - Math.clz32(bit);
      const nextRegs = regMask | (1 << regions[row * n + c]);
      cols[row] = c;
      if (apply(cur, levels[depth + 1], row, c, nextRows, nextRegs) && rec(depth + 1, nextRows, nextRegs)) return true;
    }
    cols[row] = -1;
    return false;
  }

  if (forcedCell < 0) {
    rec(0, 0, 0);
    return found;
  }
  if (regions[forcedCell] < 0) return found;
  const row = (forcedCell / n) | 0;
  const rowMask = 1 << row;
  const regMask = 1 << regions[forcedCell];
  cols[row] = forcedCell % n;
  if (apply(levels[0], levels[1], row, forcedCell % n, rowMask, regMask)) rec(1, rowMask, regMask);
  return found;
}

export function countSolutions(n, regions, limit = 2) {
  return findSolutions(n, regions, limit).length;
}

// Проверка расстановки по правилам игры (для тестов).
export function isValidSolution(n, regions, solution) {
  const colSeen = new Array(n).fill(false);
  const regSeen = new Array(n).fill(false);
  for (let r = 0; r < n; r++) {
    const c = solution[r];
    if (c < 0 || c >= n || colSeen[c]) return false;
    colSeen[c] = true;
    const g = regions[r * n + c];
    if (regSeen[g]) return false;
    regSeen[g] = true;
    if (r > 0 && Math.abs(c - solution[r - 1]) < 2) return false;
  }
  return true;
}
