// Отрисовка поля и ввод: касание, долгое нажатие, протяжка, правая кнопка мыши.

import { CAT, MARK, AUTO } from './game.js';
import { markShapeCss, anyMarkCss, resolveMark } from './marks.js';

const LONG_PRESS_MS = 420;
const FLASH_MS = 650;
const THICK_SHARE = 0.045;
const MIN_THICK_PX = 2;

// Запасные цвета комнат на случай, если оформление из content.json не годится.
// Цветов 12 — по числу комнат на самом большом поле (12×12).
const PALETTE = [
  '#F9C7C4', '#FBE3A1', '#CDE9B4', '#A9DDD6', '#A8D0F0', '#C5C0F0',
  '#E8BDEB', '#F6C48E', '#DCD3C6', '#9FCFA4', '#E79C9C', '#96A9DC',
];
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

// Допустимые значения полей темы (content.json → boards). Неизвестное значение
// игнорируется, и поле выглядит как в простой теме.
const THEME_OPTIONS = {
  texture: ['none', 'wood', 'grass', 'fabric', 'stars', 'tiles', 'paper', 'waves', 'candy', 'snow'],
  cells: ['flat', 'soft', 'bevel'],
  frame: ['plain', 'wood', 'gold', 'candy', 'neon', 'ice'],
};
const THEME_PREFIX = { texture: 'tex-', cells: 'cells-', frame: 'frame-' };
// Метка «пусто» (marks.js): класс mark-<форма>, рисунок — в --mark-shape.
const MARK_PREFIX = 'mark-';
// Сколько пикселей занимает рамка снаружи поля (её надо оставить свободными).
const FRAME_PAD_PX = 8;

function isColor(value) {
  return typeof value === 'string' && COLOR_RE.test(value);
}

// Цвета комнат темы (12 штук) или запасная палитра.
export function themePalette(theme) {
  const colors = theme && Array.isArray(theme.colors) ? theme.colors.filter(isColor) : [];
  return colors.length >= PALETTE.length ? colors : PALETTE;
}

function themeValue(theme, key) {
  const value = theme && theme[key];
  return THEME_OPTIONS[key].includes(value) ? value : THEME_OPTIONS[key][0];
}

export function hasFrame(theme) {
  return themeValue(theme, 'frame') !== 'plain';
}

// Ставит на элемент поля классы и цвета темы. Используется и для игрового поля,
// и для маленьких полей в магазине. markId — метка, выбранная в магазине
// (неизвестная или «как у поля» — берётся метка темы).
export function applyBoardTheme(el, theme, markId) {
  const prefixes = [...Object.values(THEME_PREFIX), MARK_PREFIX];
  const keep = el.className.split(/\s+/).filter((cls) => cls && !prefixes.some((prefix) => cls.startsWith(prefix)) && cls !== 'is-dark');
  for (const key of Object.keys(THEME_PREFIX)) keep.push(THEME_PREFIX[key] + themeValue(theme, key));
  const mark = resolveMark(markId, theme);
  keep.push(MARK_PREFIX + mark);
  if (theme && theme.dark) keep.push('is-dark');
  el.className = keep.join(' ');
  const shape = markShapeCss(mark);
  if (shape) el.style.setProperty('--mark-shape', shape);
  else el.style.removeProperty('--mark-shape');
  if (theme && isColor(theme.line)) el.style.setProperty('--line', theme.line);
  else el.style.removeProperty('--line');
  if (theme && isColor(theme.markColor)) el.style.setProperty('--mark', theme.markColor);
  else el.style.removeProperty('--mark');
}

// handlers: onTap(i), onLongPress(i), onDragStart(i, isAfterLongPress),
// onDragOver(i), onDragEnd().
export function createBoardView(root, handlers) {
  let n = 0;
  let cellEls = [];
  let shown = [];
  let catHtml = '';
  let hintCell = -1;
  let press = null;
  let palette = PALETTE;
  let framePad = 0;

  // Оформление поля из content.json → boards и метка «пусто» из магазина.
  function setTheme(theme, markId) {
    palette = themePalette(theme);
    framePad = hasFrame(theme) ? FRAME_PAD_PX : 0;
    applyBoardTheme(root, theme, markId);
  }

  function render(board) {
    n = board.n;
    root.style.setProperty('--n', String(n));
    root.classList.remove('is-won');
    root.textContent = '';
    cellEls = [];
    shown = new Array(n * n).fill(-1);
    hintCell = -1;
    for (let i = 0; i < n * n; i++) {
      const r = (i / n) | 0;
      const c = i % n;
      const cell = document.createElement('div');
      let cls = 'cell';
      if (r === 0) cls += ' r0';
      else if (board.regions[i - n] !== board.regions[i]) cls += ' t-thick';
      if (c === 0) cls += ' c0';
      else if (board.regions[i - 1] !== board.regions[i]) cls += ' l-thick';
      cell.className = cls;
      cell.dataset.base = cls;
      cell.dataset.i = String(i);
      cell.style.setProperty('--c', palette[board.colors[board.regions[i]] % palette.length]);
      cell.style.setProperty('--i', String(r + c));
      root.append(cell);
      cellEls.push(cell);
    }
  }

  // Подгоняет квадрат поля под свободное место.
  function layout(wrap) {
    const side = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight)) - framePad * 2;
    if (side <= 0 || n === 0) return;
    root.style.width = side + 'px';
    root.style.height = side + 'px';
    const thick = Math.max(MIN_THICK_PX, Math.round((side / n) * THICK_SHARE));
    root.style.setProperty('--thick', thick + 'px');
  }

  function update(cells) {
    for (let i = 0; i < cellEls.length; i++) {
      const value = cells[i];
      if (shown[i] === value) continue;
      shown[i] = value;
      const cell = cellEls[i];
      let cls = cell.dataset.base;
      if (value === MARK) cls += ' mark';
      else if (value === AUTO) cls += ' auto';
      if (i === hintCell) cls += ' is-hint';
      cell.className = cls;
      if (value === CAT) cell.innerHTML = catHtml;
      else if (cell.firstChild) cell.textContent = '';
    }
  }

  function setCat(html) {
    catHtml = html;
    shown = shown.map(() => -1);
  }

  function setHint(i) {
    if (hintCell >= 0 && cellEls[hintCell]) cellEls[hintCell].classList.remove('is-hint');
    hintCell = i;
    if (i >= 0 && cellEls[i]) cellEls[i].classList.add('is-hint');
  }

  function flash(i, cls) {
    const cell = cellEls[i];
    if (!cell) return;
    cell.classList.remove(cls);
    void cell.offsetWidth;
    cell.classList.add(cls);
    window.setTimeout(() => cell.classList.remove(cls), FLASH_MS);
  }

  function flashMany(list, cls) {
    for (const i of list) flash(i, cls);
  }

  function setWon(isWon) {
    root.classList.toggle('is-won', isWon);
  }

  // Центр поля на экране — отсюда разлетается эффект победы.
  function center() {
    const rect = root.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width };
  }

  // Центр клетки i на экране и её размер — отсюда разлетаются искры.
  function cellCenter(i) {
    const cell = cellEls[i];
    if (!cell) return null;
    const rect = cell.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width };
  }

  function cellAt(x, y) {
    const node = document.elementFromPoint(x, y);
    const cell = node && node.closest ? node.closest('.cell') : null;
    if (!cell || cell.parentNode !== root) return -1;
    return Number(cell.dataset.i);
  }

  function endPress(isCancelled) {
    if (!press) return;
    window.clearTimeout(press.timer);
    const current = press;
    press = null;
    if (current.isDrag) handlers.onDragEnd();
    else if (!current.isLong && !isCancelled) handlers.onTap(current.start);
  }

  root.addEventListener('pointerdown', (event) => {
    const i = cellAt(event.clientX, event.clientY);
    if (i < 0) return;
    event.preventDefault();
    if (event.button === 2) {
      handlers.onLongPress(i);
      return;
    }
    if (event.button !== 0) return;
    endPress(true);
    const state = { start: i, last: i, isLong: false, isDrag: false, timer: 0 };
    state.timer = window.setTimeout(() => {
      state.isLong = true;
      handlers.onLongPress(i);
    }, LONG_PRESS_MS);
    press = state;
  });

  window.addEventListener('pointermove', (event) => {
    if (!press) return;
    const j = cellAt(event.clientX, event.clientY);
    if (j < 0 || j === press.last) return;
    if (!press.isDrag) {
      window.clearTimeout(press.timer);
      press.isDrag = true;
      handlers.onDragStart(press.start, press.isLong);
    }
    press.last = j;
    handlers.onDragOver(j);
  });

  window.addEventListener('pointerup', () => endPress(false));
  window.addEventListener('pointercancel', () => endPress(true));
  root.addEventListener('contextmenu', (event) => event.preventDefault());

  return { setTheme, render, layout, update, setCat, setHint, flash, flashMany, setWon, center, cellCenter };
}

// Маленькое неигровое поле для магазина: size×size клеток, комнаты из layout,
// в клетках cats — котики, в клетках marks — отметки «пусто» игрока, в autos —
// отметки, которые ставит игра; mark — метка из магазина; cellMarks — своя метка
// в отдельных клетках ({ номер клетки: форма }).
export function miniBoard(theme, options) {
  const { size, layout, cats = [], marks = [], autos = [], catHtml = '', mark = '', cellMarks = {} } = options;
  const palette = themePalette(theme);
  const root = document.createElement('div');
  root.className = 'board board-mini';
  applyBoardTheme(root, theme, mark);
  root.style.setProperty('--n', String(size));
  for (let i = 0; i < size * size; i++) {
    const r = (i / size) | 0;
    const c = i % size;
    const cell = document.createElement('div');
    let cls = 'cell';
    if (r === 0) cls += ' r0';
    else if (layout[i - size] !== layout[i]) cls += ' t-thick';
    if (c === 0) cls += ' c0';
    else if (layout[i - 1] !== layout[i]) cls += ' l-thick';
    if (marks.includes(i)) cls += ' mark';
    else if (autos.includes(i)) cls += ' auto';
    cell.className = cls;
    cell.style.setProperty('--c', palette[layout[i] % palette.length]);
    if (cellMarks[i]) cell.style.setProperty('--mark-shape', anyMarkCss(cellMarks[i]));
    if (cats.includes(i)) cell.innerHTML = catHtml;
    root.append(cell);
  }
  return root;
}
