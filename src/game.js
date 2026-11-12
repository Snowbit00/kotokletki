// Состояние одной партии: клетки, ошибки, отмена хода, подсказка, время.
// Здесь нет работы с экраном — только правила.

import { findHint } from './difficulty.js';

export const EMPTY = 0;
export const CAT = 1;
export const MARK = 2; // отметка игрока «здесь пусто»
export const AUTO = 3; // клетка, про которую игра сама знает, что она пустая

// board — поле из генератора. options: maxMistakes (0 — без лимита),
// autoMark (отмечать пустые клетки после кота), saved (снимок для продолжения).
export function createGame(board, options = {}) {
  const { n, regions, solution } = board;
  const size = n * n;
  const maxMistakes = options.maxMistakes || 0;

  let cells = new Array(size).fill(EMPTY);
  let cats = 0;
  let mistakes = 0;
  let extraLives = 0; // дополнительные попытки, полученные за ролик
  let hintsUsed = 0;
  let isAutoMark = options.autoMark !== false;
  let history = [];
  let group = null;
  let elapsed = 0;
  let startedAt = 0;

  restore(options.saved);

  function restore(saved) {
    if (!saved || !Array.isArray(saved.cells) || saved.cells.length !== size) return;
    const isClean = saved.cells.every((v, i) => (v === CAT ? isSolutionCell(i) : v === EMPTY || v === MARK || v === AUTO));
    if (!isClean) return;
    cells = saved.cells.slice();
    cats = cells.filter((v) => v === CAT).length;
    mistakes = Number.isFinite(saved.mistakes) ? Math.max(0, saved.mistakes) : 0;
    extraLives = Number.isFinite(saved.extraLives) ? Math.max(0, saved.extraLives) : 0;
    hintsUsed = Number.isFinite(saved.hintsUsed) ? Math.max(0, saved.hintsUsed) : 0;
    elapsed = Number.isFinite(saved.elapsed) ? Math.max(0, saved.elapsed) : 0;
  }

  function isSolutionCell(i) {
    return solution[(i / n) | 0] === i % n;
  }

  function isWon() {
    return cats === n;
  }

  // Сколько ошибок ещё можно сделать. При игре без лимита — бесконечность.
  function getLives() {
    if (maxMistakes <= 0) return Infinity;
    return Math.max(0, maxMistakes + extraLives - mistakes);
  }

  function isFailed() {
    return getLives() === 0 && !isWon();
  }

  function isOver() {
    return isWon() || isFailed();
  }

  // Клетки, которые кот в клетке i делает пустыми: строка, столбец, комната, соседи.
  function peersOf(i) {
    const r = (i / n) | 0;
    const c = i % n;
    const out = [];
    for (let j = 0; j < size; j++) {
      if (j === i) continue;
      const rr = (j / n) | 0;
      const cc = j % n;
      const isNear = Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1;
      if (rr === r || cc === c || regions[j] === regions[i] || isNear) out.push(j);
    }
    return out;
  }

  // Почему в клетку i нельзя кота, если мешает уже стоящий кот.
  function conflictOf(i) {
    const r = (i / n) | 0;
    const c = i % n;
    for (let j = 0; j < size; j++) {
      if (cells[j] !== CAT) continue;
      const rr = (j / n) | 0;
      const cc = j % n;
      if (regions[j] === regions[i]) return { reason: 'room', cell: j };
      if (rr === r) return { reason: 'row', cell: j };
      if (cc === c) return { reason: 'col', cell: j };
      if (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1) return { reason: 'near', cell: j };
    }
    return null;
  }

  function setCell(i, value, changes) {
    if (cells[i] === value) return;
    changes.push([i, cells[i]]);
    if (cells[i] === CAT) cats--;
    if (value === CAT) cats++;
    cells[i] = value;
  }

  function placeCat(i, changes) {
    setCell(i, CAT, changes);
    if (!isAutoMark) return;
    for (const j of peersOf(i)) {
      if (cells[j] === EMPTY) setCell(j, AUTO, changes);
    }
  }

  function commit(changes) {
    if (changes.length) history.push(changes);
  }

  // Касание в режиме «Кот».
  function tapCat(i) {
    if (isOver()) return { type: 'none' };
    const value = cells[i];
    if (value === CAT) return { type: 'none' };
    if (value === AUTO) return { type: 'locked' };
    if (value === MARK) {
      const changes = [];
      setCell(i, EMPTY, changes);
      commit(changes);
      return { type: 'clear' };
    }
    if (!isSolutionCell(i)) {
      const conflict = conflictOf(i);
      mistakes++;
      cells[i] = AUTO;
      return {
        type: 'wrong',
        reason: conflict ? conflict.reason : 'wrong',
        conflictCell: conflict ? conflict.cell : -1,
        isFailed: isFailed(),
      };
    }
    const changes = [];
    placeCat(i, changes);
    commit(changes);
    return { type: 'cat', isWon: isWon() };
  }

  // Поставить или снять отметку «пусто». value: true/false, undefined — переключить.
  function setMark(i, value) {
    if (isOver()) return false;
    const current = cells[i];
    if (current !== EMPTY && current !== MARK) return false;
    const wanted = value === undefined ? current !== MARK : value;
    const next = wanted ? MARK : EMPTY;
    if (next === current) return false;
    const changes = group || [];
    setCell(i, next, changes);
    if (!group) commit(changes);
    return true;
  }

  // Несколько отметок одним движением пальца отменяются одним нажатием «Отмена».
  function beginGroup() {
    group = [];
  }

  function endGroup() {
    if (group) commit(group);
    group = null;
  }

  function undo() {
    if (isOver()) return false;
    const changes = history.pop();
    if (!changes) return false;
    for (let k = changes.length - 1; k >= 0; k--) {
      const [i, previous] = changes[k];
      if (cells[i] === CAT) cats--;
      if (previous === CAT) cats++;
      cells[i] = previous;
    }
    return true;
  }

  // Следующая клетка, которую можно вывести логикой: { cell, house }.
  // house: 0..n-1 — комната, n..2n-1 — строка, 2n..3n-1 — столбец, -1 — без объяснения.
  function peekHint() {
    if (isOver()) return null;
    const catCells = [];
    for (let i = 0; i < size; i++) if (cells[i] === CAT) catCells.push(i);
    const found = findHint(n, regions, catCells);
    if (found) return { cell: found.cell, house: found.house };
    for (let r = 0; r < n; r++) {
      const i = r * n + solution[r];
      if (cells[i] !== CAT) return { cell: i, house: -1 };
    }
    return null;
  }

  function useHint() {
    const hint = peekHint();
    if (!hint) return null;
    const changes = [];
    placeCat(hint.cell, changes);
    commit(changes);
    hintsUsed++;
    return { ...hint, isWon: isWon() };
  }

  function houseCells(house) {
    const out = [];
    for (let i = 0; i < size; i++) {
      const isIn = house < n ? regions[i] === house : house < 2 * n ? ((i / n) | 0) === house - n : i % n === house - 2 * n;
      if (isIn) out.push(i);
    }
    return out;
  }

  function resume() {
    if (!startedAt && !isOver()) startedAt = Date.now();
  }

  function pause() {
    if (!startedAt) return;
    elapsed += Date.now() - startedAt;
    startedAt = 0;
  }

  function getElapsed() {
    return elapsed + (startedAt ? Date.now() - startedAt : 0);
  }

  return {
    n,
    board,
    maxMistakes,
    tapCat,
    setMark,
    beginGroup,
    endGroup,
    undo,
    peekHint,
    useHint,
    houseCells,
    resume,
    pause,
    getElapsed,
    isWon,
    isFailed,
    isOver,
    setAutoMark(value) {
      isAutoMark = value !== false;
    },
    getCells() {
      return cells;
    },
    getMistakes() {
      return mistakes;
    },
    getLives,
    // Ещё одна попытка после исчерпания лимита (за ролик).
    addLife() {
      extraLives++;
    },
    getCats() {
      return cats;
    },
    canUndo() {
      return history.length > 0 && !isOver();
    },
    snapshot() {
      return { cells: cells.slice(), mistakes, extraLives, hintsUsed, elapsed: getElapsed() };
    },
  };
}
