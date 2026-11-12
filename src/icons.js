// Значки интерфейса в чиби-стиле: объём (градиент), блик и общий тёмно-коричневый контур,
// как у котиков (cats.js). Контур рисуется отдельным слоем под заливками — так у фигуры из
// нескольких частей получается один общий силуэт.
// iconSvg(name, options) возвращает SVG-разметку или '' для неизвестного значка.
// У каждого вызова свои id градиентов: на странице может быть много одинаковых значков.

const OUTLINE = '#5A3324';
const OUTLINE_WIDTH = 2.4;
const SHINE = 'rgba(255, 255, 255, 0.75)';

let counter = 0;

function nextId() {
  counter += 1;
  return 'ic' + counter;
}

// Вертикальный градиент: светлее сверху.
function grad(id, top, bottom) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
}

// Силуэт с контуром: shapes — строка с фигурами (path, circle, rect…) без заливки.
function silhouette(shapes) {
  return `<g fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="${OUTLINE_WIDTH}" stroke-linejoin="round" stroke-linecap="round">${shapes}</g>`;
}

function svg(viewBox, body) {
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

// ---------- Рыбка ----------

const FISH_TAIL = 'M8.6 12C6.2 9 4.2 6.6 2.4 5.3c-.8-.5-1.5.2-1.1 1 1 2 1.8 3.9 2.2 5.7-.4 1.8-1.2 3.7-2.2 5.7-.4.8.3 1.5 1.1 1 1.8-1.3 3.8-3.7 6.2-6.7z';
const FISH_BODY = 'M7.6 12c2-5.6 7.5-8 12.9-7.8 6 .2 10.2 3.8 10.5 7.8-.3 4-4.5 7.6-10.5 7.8-5.4.2-10.9-2.2-12.9-7.8z';
const FISH_FIN = 'M14.6 5.6c1.4-3.2 5-4 7.8-3 -1.1 1-1.4 1.9-1.5 2.6';

function fish() {
  const id = nextId();
  return svg(
    '0 0 32 24',
    `<defs>${grad(id + 'b', '#7FDBFF', '#2F86D6')}${grad(id + 't', '#5FC4F5', '#2A73C2')}</defs>` +
      silhouette(`<path d="${FISH_TAIL}"/><path d="${FISH_BODY}"/><path d="${FISH_FIN}"/>`) +
      `<path d="${FISH_TAIL}" fill="url(#${id}t)"/>` +
      `<path d="${FISH_FIN}" fill="#3C9BE0"/>` +
      `<path d="${FISH_BODY}" fill="url(#${id}b)"/>` +
      // светлое брюшко
      `<path d="M11 13.6c3 4 8 5 12.5 4.2 3-.6 5.1-2.2 6.1-4.2-3.6 1.4-11.6 2.2-18.6 0z" fill="#CFF1FF" opacity="0.85"/>` +
      // чешуйки
      `<g fill="none" stroke="#B5E9FF" stroke-width="1.1" stroke-linecap="round" opacity="0.9"><path d="M13.2 8.6q1.6 1.7 0 3.4"/><path d="M16.4 7.6q1.8 2 0 4"/><path d="M16.2 12.4q1.4 1.4 0 2.8"/></g>` +
      // боковой плавник
      `<path d="M18 13.2c1.6.5 3 2 3.2 3.6-1.8-.2-3-1.4-3.2-3.6z" fill="#2F86D6"/>` +
      // блик
      `<ellipse cx="20" cy="7.4" rx="4" ry="1.3" fill="${SHINE}" transform="rotate(-8 20 7.4)"/>` +
      // глаз, румянец, ротик
      `<circle cx="25.2" cy="10.6" r="2.4" fill="#2E1A12"/><circle cx="26" cy="9.7" r="0.95" fill="#FFFFFF"/><circle cx="24.5" cy="11.5" r="0.45" fill="#FFFFFF"/>` +
      `<ellipse cx="27.3" cy="13.6" rx="1.6" ry="1" fill="#FF8FA3" opacity="0.65"/>` +
      `<path d="M30 12.6q-.7.8-1.5.3" fill="none" stroke="${OUTLINE}" stroke-width="0.9" stroke-linecap="round"/>`
  );
}

// ---------- Огонёк серии ----------

const FLAME = 'M12 2.4c1.2 3.8 6.6 6 6.6 11.8a6.6 6.6 0 0 1-13.2 0c0-3.2 1.9-5.2 3.5-6.4 0 2.2 1 3.5 2.2 3.5.4-3.3-.8-5.9.9-8.9z';

function flame() {
  const id = nextId();
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FFC14D', '#F0561C')}</defs>` +
      silhouette(`<path d="${FLAME}"/>`) +
      `<path d="${FLAME}" fill="url(#${id})"/>` +
      `<path d="M12 11c1 1.8 3.3 2.9 3.3 5.5a3.3 3.3 0 0 1-6.6 0c0-2 1.9-3.1 3.3-5.5z" fill="#FFE27A"/>` +
      `<ellipse cx="8.9" cy="13" rx="1" ry="2" fill="${SHINE}" transform="rotate(20 8.9 13)"/>`
  );
}

// ---------- Настройки: шестерёнка с лапкой ----------

function gear() {
  const id = nextId();
  let teeth = '';
  for (let k = 0; k < 8; k++) teeth += `<rect x="9.8" y="1.4" width="4.4" height="5" rx="1.3" transform="rotate(${k * 45} 12 12)"/>`;
  const body = teeth + '<circle cx="12" cy="12" r="7.4"/>';
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#E7EDF4', '#A9B6C6')}</defs>` +
      silhouette(body) +
      `<g fill="url(#${id})">${body}</g>` +
      `<circle cx="12" cy="12" r="4.6" fill="#FFFFFF"/>` +
      // лапка в серединке
      `<g fill="#F08A5D"><circle cx="9.9" cy="10.9" r="0.95"/><circle cx="11.3" cy="9.6" r="0.95"/><circle cx="12.8" cy="9.6" r="0.95"/><circle cx="14.2" cy="10.9" r="0.95"/><path d="M12 11.6c1.3 0 2.5 1.2 2.5 2.2s-1.1 1.5-2.5 1.5-2.5-.5-2.5-1.5 1.2-2.2 2.5-2.2z"/></g>` +
      `<path d="M6.6 8.4a6.6 6.6 0 0 1 3.4-3" fill="none" stroke="${SHINE}" stroke-width="1.3" stroke-linecap="round"/>`
  );
}

// ---------- Подсказка: лампочка ----------

const BULB = 'M12 2.6a6.9 6.9 0 0 0-4.5 12.2c1 1 1.4 2 1.5 3H15c.1-1 .5-2 1.5-3A6.9 6.9 0 0 0 12 2.6z';

function bulb() {
  const id = nextId();
  return svg(
    '0 0 24 24',
    `<defs><radialGradient id="${id}" cx="0.45" cy="0.35" r="0.7"><stop offset="0" stop-color="#FFFBD6"/><stop offset="0.6" stop-color="#FFE45C"/><stop offset="1" stop-color="#F6B820"/></radialGradient></defs>` +
      silhouette(`<path d="${BULB}"/><rect x="8.8" y="17.4" width="6.4" height="4.2" rx="1.4"/>`) +
      `<path d="${BULB}" fill="url(#${id})"/>` +
      `<rect x="8.8" y="17.4" width="6.4" height="4.2" rx="1.4" fill="#A8B3C4"/>` +
      `<path d="M9 19.4h6" stroke="#7D899B" stroke-width="0.9"/>` +
      `<path d="M10.4 13.6l1.6-2.6 1.6 2.6" fill="none" stroke="#E39A18" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<ellipse cx="9.4" cy="7.6" rx="1.2" ry="2.1" fill="${SHINE}" transform="rotate(30 9.4 7.6)"/>`
  );
}

// ---------- Отмена: толстая стрелка ----------

function undo() {
  const arc = 'M8.6 10.2H14a4.6 4.6 0 0 1 0 9.2h-3.4';
  const head = 'M9.4 5.4L3.6 10.2l5.8 4.8z';
  return svg(
    '0 0 24 24',
    `<path d="${arc}" fill="none" stroke="${OUTLINE}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="${head}" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path d="${arc}" fill="none" stroke="#7CC0F0" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="${head}" fill="#7CC0F0"/>` +
      `<path d="M14 11.6a3 3 0 0 1 2.6 1.6" fill="none" stroke="${SHINE}" stroke-width="1" stroke-linecap="round"/>`
  );
}

// ---------- Ролик: хлопушка ----------

function video() {
  const id = nextId();
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#5B5F73', '#33364A')}</defs>` +
      silhouette('<rect x="3" y="9" width="18" height="12" rx="2.4"/><path d="M3.4 8.6l16.4-4.2.9 3.4L4.3 12z"/>') +
      `<rect x="3" y="9" width="18" height="12" rx="2.4" fill="url(#${id})"/>` +
      `<path d="M3.4 8.6l16.4-4.2.9 3.4L4.3 12z" fill="#FFFFFF"/>` +
      `<path d="M6.8 7.7l1.7 3M11 6.6l1.7 3M15.2 5.5l1.7 3" stroke="#33364A" stroke-width="1.8"/>` +
      `<path d="M10.4 12.6l5 2.8-5 2.8z" fill="#FFD166"/>`
  );
}

// ---------- Лапка (жизни) ----------

function paw() {
  const id = nextId();
  const toes = '<circle cx="5.6" cy="10" r="2.5"/><circle cx="9.7" cy="5.8" r="2.5"/><circle cx="14.3" cy="5.8" r="2.5"/><circle cx="18.4" cy="10" r="2.5"/>';
  const pad = '<path d="M12 11.4c3.1 0 6 3 6 5.4s-2.6 3.8-6 3.8-6-1.4-6-3.8 2.9-5.4 6-5.4z"/>';
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FFB38A', '#EE6F45')}</defs>` +
      silhouette(toes + pad) +
      `<g fill="url(#${id})">${toes}${pad}</g>` +
      `<g fill="#FFC9D2"><ellipse cx="12" cy="16.6" rx="3" ry="2"/></g>` +
      `<g fill="${SHINE}"><circle cx="9" cy="5" r="0.8"/><circle cx="13.6" cy="5" r="0.8"/><circle cx="4.9" cy="9.2" r="0.7"/><circle cx="17.7" cy="9.2" r="0.7"/></g>`
  );
}

// ---------- Звезда (оценка) ----------

const STAR = 'M12 2.2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.2l-6 3.4 1.3-6.7-5-4.7 6.8-.8z';

function star() {
  const id = nextId();
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FFE98A', '#F5A912')}</defs>` +
      silhouette(`<path d="${STAR}"/>`) +
      `<path d="${STAR}" fill="url(#${id})"/>` +
      `<path d="M9.6 8.8l2.4-4.4" stroke="${SHINE}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<circle cx="9" cy="11" r="0.9" fill="${SHINE}"/>`
  );
}

// ---------- Календарь (задача дня) ----------

function calendar(options) {
  const id = nextId();
  const day = options && Number.isFinite(options.day) ? String(options.day) : '';
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FF8A8F', '#E5484F')}</defs>` +
      silhouette('<rect x="3" y="4.6" width="18" height="16.6" rx="3"/>') +
      `<rect x="3" y="4.6" width="18" height="16.6" rx="3" fill="#FFFFFF"/>` +
      `<path d="M3 7.6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2.2H3z" fill="url(#${id})"/>` +
      `<g fill="${OUTLINE}"><rect x="7" y="2.4" width="2" height="4.4" rx="1"/><rect x="15" y="2.4" width="2" height="4.4" rx="1"/></g>` +
      (day
        ? `<text x="12" y="18.6" text-anchor="middle" font-family="'Segoe UI Black','Segoe UI',Arial,sans-serif" font-weight="900" font-size="${day.length > 1 ? 8.4 : 9.4}" fill="${OUTLINE}">${day}</text>`
        : `<g fill="#F08A5D"><circle cx="8.6" cy="14.6" r="1.4"/><circle cx="12" cy="14.6" r="1.4"/><circle cx="15.4" cy="14.6" r="1.4"/></g>`)
  );
}

// ---------- Кубик (свободная игра) ----------

function dice() {
  const id = nextId();
  const box = '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.2" transform="rotate(-10 12 12)"/>';
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FFFFFF', '#EADFD3')}</defs>` +
      silhouette(box) +
      `<g fill="url(#${id})">${box}</g>` +
      `<g fill="#F0656B" transform="rotate(-10 12 12)"><circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="8" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="8" cy="16" r="1.6"/><circle cx="16" cy="16" r="1.6"/></g>` +
      `<path d="M6.2 6.8a2.6 2.6 0 0 1 2-1.6" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" transform="rotate(-10 12 12)"/>`
  );
}

// ---------- Сумка (магазин) ----------

function bag() {
  const id = nextId();
  const body = 'M4.6 8.6h14.8l-1.1 11a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8z';
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FFB27A', '#EE7440')}</defs>` +
      `<path d="M8.4 9.6V7a3.6 3.6 0 0 1 7.2 0v2.6" fill="none" stroke="${OUTLINE}" stroke-width="4.4" stroke-linecap="round"/>` +
      `<path d="M8.4 9.6V7a3.6 3.6 0 0 1 7.2 0v2.6" fill="none" stroke="#FFD9B8" stroke-width="1.8" stroke-linecap="round"/>` +
      silhouette(`<path d="${body}"/>`) +
      `<path d="${body}" fill="url(#${id})"/>` +
      // рыбка на сумке
      `<path d="M8.4 15c1.2-1.9 3.4-2.4 5-1.2l2.1-1.5v5.4l-2.1-1.5c-1.6 1.2-3.8.7-5-1.2z" fill="#FFFFFF"/>` +
      `<circle cx="10.4" cy="14.6" r="0.55" fill="${OUTLINE}"/>` +
      `<ellipse cx="7.4" cy="11.4" rx="0.9" ry="1.8" fill="${SHINE}" transform="rotate(15 7.4 11.4)"/>`
  );
}

// ---------- Как играть: облачко с «?» ----------

function help() {
  const id = nextId();
  const cloud = 'M12 3.2c5 0 8.8 3.2 8.8 7.4s-3.8 7.4-8.8 7.4c-.9 0-1.8-.1-2.6-.3L5 20.4l1-4.1c-1.8-1.4-2.8-3.4-2.8-5.7C3.2 6.4 7 3.2 12 3.2z';
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#9FE0FF', '#4FA6E8')}</defs>` +
      silhouette(`<path d="${cloud}"/>`) +
      `<path d="${cloud}" fill="url(#${id})"/>` +
      `<text x="12" y="14.6" text-anchor="middle" font-family="'Segoe UI Black','Segoe UI',Arial,sans-serif" font-weight="900" font-size="10.5" fill="#FFFFFF">?</text>` +
      `<ellipse cx="7.6" cy="7.4" rx="1.6" ry="0.9" fill="${SHINE}" transform="rotate(-30 7.6 7.4)"/>`
  );
}

// ---------- Кубок (таблица дня) ----------

function trophy() {
  const id = nextId();
  const cup = 'M6.6 3.4h10.8v5.4a5.4 5.4 0 0 1-10.8 0z';
  const base = 'M10.6 13.8h2.8v3.4h2.4a1.6 1.6 0 0 1 1.6 1.6v1.8H6.6v-1.8a1.6 1.6 0 0 1 1.6-1.6h2.4z';
  const handles = 'M6.8 5.6H4.4a2.6 2.6 0 0 0 2.8 4.2M17.2 5.6h2.4a2.6 2.6 0 0 1-2.8 4.2';
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FFE98A', '#F0A30F')}</defs>` +
      `<path d="${handles}" fill="none" stroke="${OUTLINE}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="${handles}" fill="none" stroke="#F5B921" stroke-width="1.6" stroke-linecap="round"/>` +
      silhouette(`<path d="${cup}"/><path d="${base}"/>`) +
      `<path d="${cup}" fill="url(#${id})"/><path d="${base}" fill="url(#${id})"/>` +
      `<path d="M12 5.2l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="#FFFFFF" opacity="0.85"/>` +
      `<path d="M8.6 5v3.4" stroke="${SHINE}" stroke-width="1.2" stroke-linecap="round"/>`
  );
}

// ---------- Сетка поля (выбор сложности) ----------

function grid(options) {
  const colors = (options && options.colors) || ['#F9C7C4', '#FBE3A1', '#CDE9B4', '#A8D0F0'];
  return svg(
    '0 0 24 24',
    silhouette('<rect x="3" y="3" width="18" height="18" rx="3.4"/>') +
      `<rect x="3" y="3" width="9" height="9" rx="2" fill="${colors[0]}"/><rect x="12" y="3" width="9" height="9" rx="2" fill="${colors[1]}"/>` +
      `<rect x="3" y="12" width="9" height="9" rx="2" fill="${colors[2]}"/><rect x="12" y="12" width="9" height="9" rx="2" fill="${colors[3]}"/>` +
      `<path d="M12 3v18M3 12h18" stroke="${OUTLINE}" stroke-width="1.4"/>` +
      `<circle cx="16.5" cy="7.5" r="2" fill="#F08A5D"/><circle cx="7.5" cy="16.5" r="1.2" fill="${OUTLINE}" opacity="0.6"/>`
  );
}

// ---------- Сердечко (победы без ошибок) ----------

const HEART = 'M12 20.6s-8.4-5.2-8.4-11a4.6 4.6 0 0 1 8.4-2.6 4.6 4.6 0 0 1 8.4 2.6c0 5.8-8.4 11-8.4 11z';

function heart() {
  const id = nextId();
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FF9DB4', '#E8466C')}</defs>` +
      silhouette(`<path d="${HEART}"/>`) +
      `<path d="${HEART}" fill="url(#${id})"/>` +
      `<ellipse cx="8" cy="8.6" rx="1.7" ry="1.1" fill="${SHINE}" transform="rotate(-35 8 8.6)"/>`
  );
}

// ---------- Часы (время в игре) ----------

function clock() {
  const id = nextId();
  return svg(
    '0 0 24 24',
    `<defs>${grad(id, '#FFB27A', '#EE7440')}</defs>` +
      silhouette('<circle cx="12" cy="12.6" r="8.8"/><rect x="10" y="1.6" width="4" height="3" rx="1"/>') +
      `<circle cx="12" cy="12.6" r="8.8" fill="url(#${id})"/>` +
      `<rect x="10" y="1.6" width="4" height="3" rx="1" fill="#EE7440"/>` +
      `<circle cx="12" cy="12.6" r="6.4" fill="#FFFFFF"/>` +
      `<path d="M12 8.6v4.2l2.8 1.8" fill="none" stroke="${OUTLINE}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="12" cy="12.8" r="0.9" fill="${OUTLINE}"/>`
  );
}

const ICONS = { fish, flame, gear, bulb, undo, video, paw, star, calendar, dice, bag, help, trophy, grid, heart, clock };

export function iconSvg(name, options) {
  return Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name](options) : '';
}

export const ICON_NAMES = Object.keys(ICONS);
