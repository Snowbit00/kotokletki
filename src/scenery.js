// Рисованные фоны тем поля: пейзаж внизу, предметы на небе и лёгкие частицы.
// Вид фона задаёт тема поля (content.json → boards → scenery). Картинок-файлов нет:
// пейзаж — SVG, повторяемый по ширине (CSS background), частицы — SVG в span с
// CSS-анимацией (только transform и opacity, до ~20 штук). Размеры — от двух
// переменных контейнера: --scn-h (высота пейзажа) и --scn-s (масштаб частиц),
// поэтому один и тот же фон рисуется и на весь экран, и в окне примерки, и в ролике.
// При prefers-reduced-motion всё неподвижно (style.css).

const TILE_W = 200; // ширина плитки пейзажа в единицах SVG; высота — 60 (у гирлянды — 40)

const dataUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const tile = (body, h = 60) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_W} ${h}" preserveAspectRatio="none">${body}</svg>`;

// Псевдослучайное число 0..1 от номера — фон всегда одинаковый.
function rnd(k, salt) {
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
const between = (range, k, salt) => range[0] + (range[1] - range[0]) * rnd(k, salt);

// ---------- Плитки пейзажа (стыкуются по краям) ----------

// Холмы: волна с bumps горбами на плитку, слева и справа одной высоты и наклона.
function hill(y, a, color, bumps = 2) {
  const step = TILE_W / (bumps * 2);
  let d = `M0 ${y} Q${step / 2} ${y - a} ${step} ${y}`;
  for (let x = step * 2; x <= TILE_W; x += step) d += ` T${x} ${y}`;
  return `<path d="${d} V60 H0 Z" fill="${color}"/>`;
}

function wave(y, a, color) {
  let line = `M0 ${y} Q12.5 ${y - a} 25 ${y}`;
  for (let x = 50; x <= TILE_W; x += 25) line += ` T${x} ${y}`;
  return `<path d="${line} V60 H0 Z" fill="${color}"/><path d="${line}" fill="none" stroke="#FFFFFF" stroke-opacity="0.65" stroke-width="1.6"/>`;
}

function bunting(colors) {
  let flags = '';
  for (let k = 0; k < 8; k++) {
    const x = 12.5 + 25 * k;
    const t = (x % 100) / 100;
    const y = 4 + 28 * t * (1 - t);
    flags += `<path d="M${x - 8} ${y - 1} L${x + 8} ${y - 1} L${x} ${y + 15} Z" fill="${colors[k % colors.length]}"/>`;
  }
  return `<path d="M0 4 Q50 18 100 4 Q150 18 200 4" fill="none" stroke="#8A6A55" stroke-width="1.2"/>${flags}`;
}

function floor() {
  let seams = '';
  for (let x = 0; x < TILE_W; x += 50) seams += `<path d="M${x} 22 V39 M${x + 25} 39 V60"/>`;
  return '<rect y="18" width="200" height="42" fill="#DDAE7E"/><rect y="18" width="200" height="5" fill="#B9824F"/>' +
    `<g stroke="#8A5A30" stroke-opacity="0.35" stroke-width="1">${seams}<path d="M0 39 H200"/></g>`;
}

function flowers() {
  const heads = ['#FFFFFF', '#FFD95A', '#FF9FC8', '#FFFFFF', '#B9A4F2'];
  let out = '';
  for (let k = 0; k < 10; k++) {
    const x = 9 + 19 * k + rnd(k, 3) * 6;
    const top = 40 + rnd(k, 4) * 10;
    out += `<path d="M${x} 60 V${top}" stroke="#5E9C4A" stroke-width="1.4"/>` +
      `<circle cx="${x}" cy="${top}" r="3.4" fill="${heads[k % heads.length]}"/><circle cx="${x}" cy="${top}" r="1.3" fill="#F2A93B"/>`;
  }
  return out;
}

function trees() {
  const list = [[30, 15, '#E8743B'], [92, 11, '#F2A93B'], [146, 17, '#C8502E'], [184, 9, '#D9B44A']];
  return list.map(([x, r, c]) => {
    const cy = 60 - 16 - r;
    return `<rect x="${x - 2.5}" y="${cy}" width="5" height="${60 - cy}" fill="#8A5A3A"/><circle cx="${x}" cy="${cy}" r="${r}" fill="${c}"/>` +
      `<circle cx="${x - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.35}" fill="#FFFFFF" fill-opacity="0.18"/>`;
  }).join('');
}

function pines() {
  const list = [[18, 26], [52, 34], [96, 22], [134, 38], [176, 28]];
  return list.map(([x, h]) => {
    const top = 60 - h;
    let tiers = '';
    for (let k = 0; k < 3; k++) {
      const y = top + k * h * 0.26;
      const w = h * (0.28 + k * 0.1);
      tiers += `<path d="M${x} ${y} L${x + w} ${y + h * 0.38} L${x - w} ${y + h * 0.38} Z" fill="#3F7A62"/>` +
        `<path d="M${x} ${y} L${x + w * 0.45} ${y + h * 0.17} L${x - w * 0.45} ${y + h * 0.17} Z" fill="#FFFFFF"/>`;
    }
    return `<rect x="${x - 2}" y="${60 - h * 0.2}" width="4" height="${h * 0.2}" fill="#6B4A32"/>${tiers}`;
  }).join('');
}

function roofs(color, windows) {
  const houses = [[4, 34, 30, 'tri'], [44, 28, 40, 'flat'], [78, 38, 25, 'tri'], [122, 28, 44, 'tri'], [156, 40, 32, 'flat']];
  let out = '';
  houses.forEach(([x, w, h, roof], k) => {
    const top = 60 - h;
    out += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${color}"/>`;
    if (roof === 'tri') out += `<path d="M${x - 3} ${top} L${x + w / 2} ${top - 13} L${x + w + 3} ${top} Z" fill="${color}"/>`;
    else out += `<rect x="${x + w - 9}" y="${top - 9}" width="5" height="9" fill="${color}"/>`;
    if (windows) {
      for (let r = 0; r < Math.floor(h / 13); r++) {
        for (let c = 0; c < Math.floor(w / 12); c++) {
          if (rnd(k * 10 + r * 3 + c, 7) < 0.55) out += `<rect x="${x + 4 + c * 12}" y="${top + 5 + r * 13}" width="5" height="6" rx="1" fill="#FFD86B"/>`;
        }
      }
    }
  });
  if (windows) {
    // Кот на крыше.
    out += `<g fill="${color}"><ellipse cx="54" cy="16" rx="5" ry="4.5"/><circle cx="54" cy="10" r="3.4"/>` +
      '<path d="M51.2 8.5 L51.6 4.8 L53.6 7.4 Z M56.8 8.5 L56.4 4.8 L54.4 7.4 Z"/><path d="M58.5 18 Q64 17 62 11" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round"/></g>';
  }
  return out;
}

function candy() {
  let top = 'M0 22';
  for (let x = 0; x < TILE_W; x += 25) top += ` Q${x + 12.5} 10 ${x + 25} 22`;
  let drips = '';
  [[16, 10], [61, 14], [107, 8], [151, 12], [186, 9]].forEach(([x, h]) => { drips += `<rect x="${x}" y="24" width="5" height="${h}" rx="2.5" fill="#FFFFFF"/>`; });
  let sprinkles = '';
  const colors = ['#FFD166', '#7BD389', '#5EB7F0', '#B48CF2', '#FFFFFF'];
  for (let k = 0; k < 16; k++) {
    const x = 6 + k * 12.3;
    const y = 40 + rnd(k, 9) * 16;
    sprinkles += `<rect x="${x}" y="${y}" width="5" height="1.8" rx="0.9" fill="${colors[k % colors.length]}" transform="rotate(${Math.round(rnd(k, 5) * 160)} ${x + 2.5} ${y + 0.9})"/>`;
  }
  return `<rect y="22" width="200" height="38" fill="#FF9EC2"/>${sprinkles}<path d="${top} V27 H0 Z" fill="#FFFFFF"/>${drips}`;
}

function arches() {
  const glass = ['#E4572E', '#F2B134', '#76B041', '#17BEBB'];
  let out = '<rect y="20" width="200" height="40" fill="#6B5848"/>';
  for (let k = 0; k < 4; k++) {
    const x = 11 + 50 * k;
    out += `<path d="M${x} 56 V36 A14 14 0 0 1 ${x + 28} 36 V56 Z" fill="${glass[k]}" fill-opacity="0.85"/>` +
      `<path d="M${x + 14} 22 V56 M${x} 42 H${x + 28}" stroke="#2B2118" stroke-opacity="0.55" stroke-width="1.4"/>` +
      `<circle cx="${x + 8}" cy="34" r="3" fill="#FFFFFF" fill-opacity="0.35"/>`;
  }
  return out;
}

function lunar() {
  let craters = '';
  [[24, 46, 9], [80, 52, 6], [128, 44, 11], [176, 54, 7]].forEach(([x, y, r]) => { craters += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.32}" fill="#241C3C"/>`; });
  return hill(32, 7, '#3B2F5C', 2) + craters;
}

// ---------- Предметы на небе ----------

const SUN = '<svg viewBox="-50 -50 100 100"><g class="scn-spin">' +
  Array.from({ length: 12 }, (_, k) => `<rect x="-3" y="-46" width="6" height="14" rx="3" fill="#FFE08A" fill-opacity="0.8" transform="rotate(${k * 30})"/>`).join('') +
  '</g><circle r="24" fill="#FFD45C"/><circle cx="-7" cy="-8" r="8" fill="#FFFFFF" fill-opacity="0.45"/></svg>';
const MOON = '<svg viewBox="-50 -50 100 100"><circle r="40" fill="#FFF4D6" fill-opacity="0.12"/><circle r="30" fill="#FFF4D6" fill-opacity="0.12"/>' +
  '<circle r="22" fill="#FFF1C9"/><circle cx="-7" cy="-5" r="5" fill="#E9DDB4"/><circle cx="8" cy="7" r="3.5" fill="#E9DDB4"/><circle cx="6" cy="-10" r="2.5" fill="#E9DDB4"/></svg>';
const PLANET = '<svg viewBox="-50 -50 100 100"><circle r="20" fill="#E98A6A"/><path d="M-20 0 A20 20 0 0 0 20 0 Z" fill="#C2577A" fill-opacity="0.55"/>' +
  '<circle cx="-7" cy="-8" r="6" fill="#FFFFFF" fill-opacity="0.35"/><ellipse rx="38" ry="9" fill="none" stroke="#FFE08A" stroke-width="3.5" transform="rotate(-18)"/></svg>';
const RAINBOW = '<svg viewBox="-50 -46 100 52"><g fill="none" stroke-width="6.5" stroke-linecap="round" stroke-opacity="0.8">' +
  [[40, '#FFB5C8'], [33.5, '#FFD98A'], [27, '#A8E0C8'], [20.5, '#B9C8FF']].map(([r, c]) => `<path d="M${-r} 0 A${r} ${r} 0 0 1 ${r} 0" stroke="${c}"/>`).join('') +
  '</g><g fill="#FFFFFF"><circle cx="-38" cy="0" r="7"/><circle cx="-30" cy="2" r="6"/><circle cx="-45" cy="3" r="5"/><circle cx="38" cy="0" r="7"/><circle cx="30" cy="2" r="6"/><circle cx="45" cy="3" r="5"/></g></svg>';
const WINDOW = '<svg viewBox="0 0 70 80"><rect x="2" y="2" width="66" height="76" rx="6" fill="#B9824F"/><rect x="8" y="8" width="54" height="64" rx="3" fill="#BFE6FA"/>' +
  '<g fill="#FFFFFF"><circle cx="24" cy="30" r="7"/><circle cx="33" cy="27" r="9"/><circle cx="42" cy="31" r="6"/><rect x="18" y="30" width="30" height="7" rx="3.5"/></g>' +
  '<path d="M35 8 V72 M8 40 H62" stroke="#B9824F" stroke-width="4"/><rect x="0" y="72" width="70" height="7" rx="3" fill="#9C6A3E"/></svg>';

// ---------- Частицы ----------

const STAR4 = 'M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z';
const SHAPES = {
  cloud: () => '<svg viewBox="0 0 64 36"><g fill="#FFFFFF" fill-opacity="0.9"><circle cx="20" cy="22" r="12"/><circle cx="36" cy="16" r="15"/><circle cx="50" cy="24" r="10"/><rect x="14" y="22" width="44" height="12" rx="6"/></g></svg>',
  bubble: (c) => `<svg viewBox="-10 -10 20 20"><circle r="8" fill="${c}" fill-opacity="0.35" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="1.4"/><circle cx="-3" cy="-3" r="2" fill="#FFFFFF"/></svg>`,
  sparkle: (c) => `<svg viewBox="-10 -10 20 20"><path d="${STAR4}" fill="${c}"/></svg>`,
  dot: (c) => `<svg viewBox="-10 -10 20 20"><circle r="8" fill="${c}" fill-opacity="0.3"/><circle r="3.5" fill="${c}"/></svg>`,
  petal: (c) => `<svg viewBox="-10 -10 20 20"><ellipse rx="4.5" ry="8" fill="${c}"/></svg>`,
  leaf: (c) => `<svg viewBox="-10 -10 20 20"><path d="M0 -9 C7 -4 7 4 0 9 C-7 4 -7 -4 0 -9 Z" fill="${c}"/><path d="M0 -8 V8" stroke="#7A3E1A" stroke-opacity="0.4" stroke-width="1"/></svg>`,
  heart: (c) => `<svg viewBox="-10 -10 20 20"><path d="M0 7 C-10 0 -9 -8 -4 -8 C-2 -8 0 -6.5 0 -4.5 C0 -6.5 2 -8 4 -8 C9 -8 10 0 0 7 Z" fill="${c}"/></svg>`,
  flake: (c) => `<svg viewBox="-10 -10 20 20"><g stroke="${c}" stroke-width="2" stroke-linecap="round"><path d="M0 -8 V8"/><path d="M-7 -4 L7 4"/><path d="M-7 4 L7 -4"/></g></svg>`,
  snowball: (c) => `<svg viewBox="-10 -10 20 20"><circle r="5" fill="${c}"/></svg>`,
  confetti: (c) => `<svg viewBox="-10 -10 20 20"><rect x="-7" y="-3.5" width="14" height="7" rx="1.5" fill="${c}"/></svg>`,
  balloon: (c) => `<svg viewBox="-10 -12 20 20"><path d="M0 7 Q-2 12 1 16" fill="none" stroke="#8A6A55" stroke-width="0.8"/><ellipse cy="-2" rx="7" ry="8.5" fill="${c}"/><path d="M-1.5 6.5 L1.5 6.5 L0 4 Z" fill="${c}"/><ellipse cx="-2.5" cy="-5" rx="2" ry="3" fill="#FFFFFF" fill-opacity="0.45"/></svg>`,
  butterfly: (c) => `<svg viewBox="-10 -10 20 20"><g class="scn-flap"><ellipse cx="-4.5" cy="-2.5" rx="4.5" ry="5" fill="${c}"/><ellipse cx="4.5" cy="-2.5" rx="4.5" ry="5" fill="${c}"/>` +
    `<ellipse cx="-3.5" cy="4" rx="3" ry="3.4" fill="${c}"/><ellipse cx="3.5" cy="4" rx="3" ry="3.4" fill="${c}"/></g><rect x="-0.8" y="-6" width="1.6" height="13" rx="0.8" fill="#4A3426"/></svg>`,
  bird: (c) => `<svg viewBox="-10 -10 20 20"><path class="scn-flap" d="M-9 0 Q-4.5 -6 0 0 Q4.5 -6 9 0" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  shoot: () => '<svg viewBox="0 0 60 10"><path d="M0 5 L54 3.2 L60 5 L54 6.8 Z" fill="#FFFFFF" fill-opacity="0.85"/><circle cx="56" cy="5" r="2.6" fill="#FFFFFF"/></svg>',
};

// ---------- Виды фона ----------
// layers: плитки пейзажа снизу вверх (k — доля высоты --scn-h, x — сдвиг узора, move — секунды
// на проход плитки, top — гирлянда сверху). parts: частицы (type — fall | rise | twinkle | drift | bob | shoot).

const PASTEL = ['#FFB5C8', '#FFD98A', '#A8E0C8', '#B9C8FF', '#E6B8F2'];

export const SCENERY = {
  // Пастель (базовое поле): пастельные холмы, облака, пузырьки и искорки.
  dreamy: {
    root: 'radial-gradient(circle at 12% 18%, rgba(255,255,255,0.75) 0, rgba(255,255,255,0) 32%), radial-gradient(circle at 88% 30%, rgba(255,205,225,0.55) 0, rgba(255,205,225,0) 38%)',
    layers: [
      { svg: tile(hill(28, 10, '#F6C4D5', 1)), k: 1 },
      { svg: tile(hill(38, 8, '#FAD79E', 2)), k: 0.8, x: -70 },
      { svg: tile(hill(46, 6, '#B5E3C6', 2) + flowers()), k: 0.62, x: -30 },
    ],
    sky: { svg: RAINBOW, side: 'left', size: 120 },
    parts: [
      { type: 'drift', shape: 'cloud', count: 3, size: [70, 110], dur: [45, 70], y: [6, 34] },
      { type: 'rise', shape: 'bubble', colors: PASTEL, count: 7, size: [12, 24], dur: [10, 16] },
      { type: 'twinkle', shape: 'sparkle', colors: ['#FFFFFF', '#FFE27A'], count: 8, size: [8, 14], dur: [2, 3.6], y: [8, 70] },
    ],
  },
  // Акварель: размытые цветные пятна, мягкие холмы, падающие лепестки.
  watercolor: {
    root: 'radial-gradient(ellipse at 8% 14%, rgba(247,168,196,0.38) 0, rgba(247,168,196,0) 40%), radial-gradient(ellipse at 92% 24%, rgba(183,202,157,0.4) 0, rgba(183,202,157,0) 42%), radial-gradient(ellipse at 18% 88%, rgba(230,188,154,0.4) 0, rgba(230,188,154,0) 45%), radial-gradient(ellipse at 86% 80%, rgba(160,200,230,0.36) 0, rgba(160,200,230,0) 45%)',
    layers: [
      { svg: tile(hill(32, 12, 'rgba(183,202,157,0.55)', 1)), k: 1 },
      { svg: tile(hill(44, 8, 'rgba(230,188,154,0.55)', 2)), k: 0.7, x: -50 },
    ],
    parts: [
      { type: 'fall', shape: 'petal', colors: ['#F7A8C4', '#FFD1DF', '#F48FB1', '#FFFFFF'], count: 11, size: [9, 14], dur: [9, 14] },
      { type: 'bob', shape: 'butterfly', colors: ['#F7A8C4', '#B7CA9D'], count: 2, size: [16, 20], dur: [3.2, 4.4], y: [40, 70] },
    ],
  },
  // Яркое: гирлянда флажков, цветные пятна света, конфетти и шарики.
  party: {
    root: 'radial-gradient(circle at 15% 70%, rgba(255,154,162,0.3) 0, rgba(255,154,162,0) 22%), radial-gradient(circle at 85% 60%, rgba(94,211,195,0.3) 0, rgba(94,211,195,0) 22%), radial-gradient(circle at 70% 90%, rgba(255,209,102,0.35) 0, rgba(255,209,102,0) 20%), radial-gradient(circle at 30% 20%, rgba(185,140,242,0.25) 0, rgba(185,140,242,0) 20%)',
    layers: [{ svg: tile(bunting(['#FF6B6B', '#FFD166', '#5ED3C3', '#B48CF2', '#FF9FC8']), 40), k: 0.5, top: true, ratio: 5 }],
    parts: [
      { type: 'fall', shape: 'confetti', colors: ['#F9736B', '#FFD166', '#7BD389', '#5EB7F0', '#B48CF2', '#FF9FC8'], count: 14, size: [8, 12], dur: [7, 11] },
      { type: 'rise', shape: 'balloon', colors: ['#FF6B6B', '#FFD166', '#5EB7F0', '#B48CF2'], count: 4, size: [22, 30], dur: [14, 20], tall: true },
    ],
  },
  // Деревянный дом: стена из досок, пол, окошко с облаком, гирлянда и пылинки в свете.
  cabin: {
    root: 'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 45%), repeating-linear-gradient(90deg, rgba(120,70,30,0.08) 0 2px, rgba(120,70,30,0) 2px 64px)',
    layers: [
      { svg: tile(floor()), k: 0.75 },
      { svg: tile(bunting(['#E8743B', '#F2C14E', '#7BB86F', '#E86A8A']), 40), k: 0.42, top: true, ratio: 5 },
    ],
    sky: { svg: WINDOW, side: 'left', size: 74 },
    parts: [
      { type: 'twinkle', shape: 'dot', colors: ['#FFF3C4'], count: 10, size: [5, 9], dur: [2.4, 4], y: [12, 70] },
    ],
  },
  // Лужайка: солнце, зелёные холмы с цветами, бабочки и облака.
  meadow: {
    root: 'radial-gradient(circle at 82% 12%, rgba(255,240,170,0.6) 0, rgba(255,240,170,0) 30%)',
    layers: [
      { svg: tile(hill(28, 10, '#C2E5A4', 1)), k: 1 },
      { svg: tile(hill(40, 8, '#9ED486', 2) + flowers()), k: 0.72, x: -40 },
    ],
    sky: { svg: SUN, side: 'right', size: 76 },
    parts: [
      { type: 'drift', shape: 'cloud', count: 2, size: [70, 100], dur: [50, 70], y: [8, 26] },
      { type: 'bob', shape: 'butterfly', colors: ['#FF9FC8', '#FFD166', '#9FD4FF'], count: 3, size: [16, 22], dur: [3, 4.5], y: [52, 78] },
      { type: 'fall', shape: 'petal', colors: ['#FFFFFF', '#FFD1DF'], count: 5, size: [7, 10], dur: [10, 14] },
    ],
  },
  // Морская: солнце, бегущие волны, пузырьки и чайки.
  seaside: {
    root: 'radial-gradient(circle at 82% 12%, rgba(255,250,210,0.7) 0, rgba(255,250,210,0) 28%)',
    layers: [
      { svg: tile(wave(26, 7, '#A7DDF4')), k: 1, move: 11 },
      { svg: tile(wave(34, 6, '#79C6EC')), k: 0.78, move: 8, x: -60, reverse: true },
      { svg: tile(wave(42, 5, '#4FA8DD')), k: 0.55, move: 6, x: -20 },
    ],
    sky: { svg: SUN, side: 'right', size: 70 },
    parts: [
      { type: 'rise', shape: 'bubble', colors: ['#FFFFFF', '#CDEBFA'], count: 9, size: [9, 18], dur: [8, 13] },
      { type: 'bob', shape: 'bird', colors: ['#3E6E99'], count: 3, size: [16, 22], dur: [2.6, 3.6], y: [14, 32] },
    ],
  },
  // Осенний сад: деревья в жёлтом и красном, падающие листья.
  orchard: {
    root: 'radial-gradient(circle at 18% 10%, rgba(255,220,170,0.6) 0, rgba(255,220,170,0) 35%)',
    layers: [
      { svg: tile(hill(26, 8, '#F2C9A2', 1)), k: 1 },
      { svg: tile(trees()), k: 1.05, b: 0.28 },
      { svg: tile(hill(42, 7, '#E3A672', 2)), k: 0.6, x: -50 },
    ],
    parts: [
      { type: 'fall', shape: 'leaf', colors: ['#E8743B', '#F2A93B', '#C8502E', '#D9B44A'], count: 12, size: [11, 16], dur: [8, 13], spin: true },
    ],
  },
  // Ночь: месяц, мерцающие звёзды, крыши с окошками и кот на крыше.
  rooftops: {
    root: 'radial-gradient(circle at 82% 14%, rgba(255,240,200,0.16) 0, rgba(255,240,200,0) 30%)',
    layers: [
      { svg: tile(roofs('#3A3456', false)), k: 1.05, x: -90 },
      { svg: tile(roofs('#262238', true)), k: 0.82 },
    ],
    sky: { svg: MOON, side: 'right', size: 84 },
    parts: [
      { type: 'twinkle', shape: 'sparkle', colors: ['#FFFFFF', '#FFF1C9'], count: 16, size: [6, 12], dur: [1.8, 3.4], y: [4, 62] },
    ],
  },
  // Карамель: полоски, кремовые холмы с посыпкой, сердечки вверх и посыпка вниз.
  sweets: {
    root: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0 14px, rgba(255,255,255,0) 14px 34px)',
    layers: [
      { svg: tile(hill(30, 9, '#FFD1E3', 1)), k: 1 },
      { svg: tile(candy()), k: 0.72, x: -40 },
    ],
    parts: [
      { type: 'rise', shape: 'heart', colors: ['#F0607E', '#FF8FAB', '#FFFFFF'], count: 9, size: [10, 16], dur: [9, 14] },
      { type: 'fall', shape: 'confetti', colors: ['#FFD166', '#7BD389', '#5EB7F0', '#B48CF2'], count: 8, size: [6, 8], dur: [8, 12] },
    ],
  },
  // Витраж: цветные лучи света, стена с витражными окнами, искры.
  cathedral: {
    root: 'linear-gradient(105deg, rgba(0,0,0,0) 8%, rgba(242,177,52,0.18) 13%, rgba(0,0,0,0) 21%, rgba(0,0,0,0) 38%, rgba(23,190,187,0.16) 45%, rgba(0,0,0,0) 53%, rgba(0,0,0,0) 64%, rgba(228,87,46,0.14) 71%, rgba(0,0,0,0) 79%)',
    layers: [{ svg: tile(arches()), k: 0.85 }],
    parts: [
      { type: 'twinkle', shape: 'sparkle', colors: ['#F2B134', '#17BEBB', '#E4572E', '#76B041', '#FFFFFF'], count: 12, size: [8, 14], dur: [2, 3.4], y: [8, 72] },
    ],
  },
  // Звёздное небо: туманности, планета с кольцом, звёзды, падающая звезда, лунный грунт.
  space: {
    root: 'radial-gradient(ellipse at 20% 30%, rgba(140,90,200,0.35) 0, rgba(140,90,200,0) 45%), radial-gradient(ellipse at 85% 72%, rgba(60,140,200,0.3) 0, rgba(60,140,200,0) 45%)',
    layers: [{ svg: tile(lunar()), k: 0.7 }],
    sky: { svg: PLANET, side: 'right', size: 86 },
    parts: [
      { type: 'twinkle', shape: 'sparkle', colors: ['#FFFFFF', '#FFE08A', '#CFE3FF'], count: 18, size: [5, 11], dur: [1.6, 3.2], y: [4, 80] },
      { type: 'shoot', shape: 'shoot', count: 1, size: [60, 60], dur: [6, 6], y: [10, 10], x: [8, 8] },
    ],
  },
  // Снежная: ели в снегу, сугробы и снегопад.
  winter: {
    root: 'radial-gradient(circle at 75% 10%, rgba(255,255,255,0.8) 0, rgba(255,255,255,0) 30%)',
    layers: [
      { svg: tile(hill(30, 8, '#E2EFFA', 1)), k: 1 },
      { svg: tile(pines()), k: 0.95, b: 0.2, x: -60 },
      { svg: tile(hill(44, 6, '#FFFFFF', 2)), k: 0.55 },
    ],
    parts: [
      { type: 'fall', shape: 'flake', colors: ['#FFFFFF'], count: 9, size: [10, 15], dur: [10, 15] },
      { type: 'fall', shape: 'snowball', colors: ['#FFFFFF'], count: 9, size: [6, 10], dur: [7, 11] },
    ],
  },
};

export const SCENERY_KINDS = Object.keys(SCENERY);

export function sceneryOf(theme) {
  const kind = theme && typeof theme.scenery === 'string' ? theme.scenery : '';
  return Object.prototype.hasOwnProperty.call(SCENERY, kind) ? kind : '';
}

function layerNode(layer, index) {
  const node = document.createElement('div');
  node.className = 'scn-layer' + (layer.top ? ' is-top' : '') + (layer.move ? ' is-moving' : '');
  node.style.backgroundImage = dataUrl(layer.svg);
  node.style.setProperty('--k', String(layer.k));
  node.style.setProperty('--ratio', String(layer.ratio || TILE_W / 60));
  if (layer.x) node.style.setProperty('--x', layer.x + 'px');
  if (layer.b) node.style.setProperty('--b', String(layer.b));
  if (layer.move) {
    node.style.setProperty('--mv', layer.move + 's');
    if (layer.reverse) node.style.animationDirection = 'reverse';
  }
  node.style.zIndex = String(index + 1);
  return node;
}

function partNodes(part, salt) {
  const nodes = [];
  const colors = part.colors || ['#FFFFFF'];
  for (let k = 0; k < part.count; k++) {
    const span = document.createElement('span');
    span.className = `scn-p scn-${part.type}`;
    const size = between(part.size, k, salt + 1);
    const duration = between(part.dur, k, salt + 2);
    const x = part.x ? between(part.x, k, salt + 3) : ((k + rnd(k, salt + 3) * 0.8) / part.count) * 100;
    span.style.setProperty('--sz', size.toFixed(1));
    span.style.setProperty('--d', duration.toFixed(2) + 's');
    // Отрицательная задержка: частицы уже в пути с первого кадра.
    span.style.setProperty('--dl', (-rnd(k, salt + 4) * duration).toFixed(2) + 's');
    span.style.setProperty('--sw', (6 + rnd(k, salt + 5) * 10).toFixed(1));
    span.style.left = x.toFixed(1) + '%';
    if (part.y) span.style.top = between(part.y, k, salt + 6).toFixed(1) + '%';
    const inner = document.createElement('i');
    if (part.tall) inner.className = 'is-tall';
    if (part.spin) inner.className = 'is-spin';
    inner.innerHTML = SHAPES[part.shape](colors[k % colors.length]);
    span.append(inner);
    nodes.push(span);
  }
  return nodes;
}

// Строит фон вида kind (или пустой). Возвращает корневой узел .scn.
export function sceneryNode(kind) {
  const root = document.createElement('div');
  root.className = 'scn' + (kind ? ' scn-' + kind : '');
  root.setAttribute('aria-hidden', 'true');
  const spec = SCENERY[kind];
  if (!spec) return root;
  if (spec.root) root.style.backgroundImage = spec.root;
  if (spec.sky) {
    const sky = document.createElement('div');
    sky.className = 'scn-sky is-' + spec.sky.side;
    sky.style.setProperty('--sz', String(spec.sky.size));
    sky.innerHTML = spec.sky.svg;
    root.append(sky);
  }
  spec.layers.forEach((layer, k) => root.append(layerNode(layer, k)));
  spec.parts.forEach((part, k) => root.append(...partNodes(part, k * 10)));
  return root;
}

// Ставит фон темы в контейнер. Если вид не сменился — ничего не делает
// (иначе анимации начинались бы заново на каждом уровне).
export function mountScenery(container, theme) {
  const kind = sceneryOf(theme);
  if (container.dataset.scenery === kind && container.firstElementChild) return;
  container.dataset.scenery = kind;
  container.replaceChildren(sceneryNode(kind));
}
